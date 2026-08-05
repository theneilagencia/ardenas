/**
 * Arden.AS API — gate de habilitação NÃO produtiva do Anthropic (ARDEN-BE-008.4 §28-37).
 *
 * A chamada REAL (SDK) só é permitida FORA de produção, para organizações em allowlist
 * server-side, com o circuit breaker fechado e dentro das quotas. Produção → sempre
 * bloqueada (MODEL_PROVIDER_DISABLED) antes de resolver credencial/tocar o SDK. Nenhuma
 * allowlist vem do request. Não apresenta valor monetário estimado.
 */

import { Inject, Injectable } from '@nestjs/common';
import { APP_CONFIG } from '../../../config/config.module';
import type { AppConfig } from '../../../config/env.schema';
import { modelProviderDisabled } from '../../../common/errors/api-error';

type BreakerState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

@Injectable()
export class AnthropicNonProdGate {
  // Circuit breaker in-memory (§37) — por processo; adequado a ambiente não produtivo.
  private failures = 0;
  private openedAtMs: number | null = null;
  // Contadores de quota diária por organização (janela UTC).
  private readonly dailyCalls = new Map<string, { dayKey: string; count: number }>();
  private concurrent = 0;

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  isProduction(): boolean {
    // Lê o ambiente VIVO (como o resolver do runtime): produção bloqueia mesmo que o
    // ambiente mude após o boot. Defesa em profundidade.
    return (process.env.NODE_ENV ?? this.config.NODE_ENV) === 'production';
  }

  /** Se a política de chamada real está ATIVA (gate de chamadas externas ligado). */
  externalCallsEnabled(): boolean {
    return this.config.ANTHROPIC_PROVIDER_EXTERNAL_CALLS_ENABLED;
  }

  /** Se o tool calling Anthropic está habilitado (ARDEN-BE-008.5). Produção nunca honra. */
  toolCallingEnabled(): boolean {
    return this.config.ANTHROPIC_TOOL_CALLING_ENABLED && !this.isProduction();
  }

  isOrgAllowed(organizationId: string): boolean {
    return this.config.anthropicNonProdAllowedOrganizationIds.includes(organizationId);
  }

  breakerState(nowMs: number): BreakerState {
    if (this.openedAtMs === null) return 'CLOSED';
    if (nowMs - this.openedAtMs >= this.config.ANTHROPIC_CIRCUIT_BREAKER_COOLDOWN_MS) return 'HALF_OPEN';
    return 'OPEN';
  }

  /**
   * Preflight da chamada REAL (§34). `nowMs`/`dayKey` injetáveis (determinístico em teste).
   * Lança MODEL_PROVIDER_DISABLED (produção/allowlist/breaker) ou erro de quota. NÃO reserva
   * concorrência aqui — use `acquire`/`release`.
   */
  assertRealCallAllowed(organizationId: string, nowMs: number, dayKey: string): void {
    if (this.isProduction()) throw modelProviderDisabled('Provider Anthropic bloqueado em produção.');
    if (!this.config.ANTHROPIC_PROVIDER_EXTERNAL_CALLS_ENABLED) throw modelProviderDisabled('Chamadas externas desabilitadas.');
    if (!this.isOrgAllowed(organizationId)) throw modelProviderDisabled('Organização não autorizada para chamada real não produtiva.');
    if (this.breakerState(nowMs) === 'OPEN') throw modelProviderDisabled('Circuit breaker aberto para o provider Anthropic.');

    const bucket = this.dailyCalls.get(organizationId);
    const count = bucket && bucket.dayKey === dayKey ? bucket.count : 0;
    if (count >= this.config.ANTHROPIC_NON_PROD_DAILY_CALL_CAP) throw modelProviderDisabled('Quota diária não produtiva excedida.');
    if (this.concurrent >= this.config.ANTHROPIC_NON_PROD_MAX_CONCURRENCY) throw modelProviderDisabled('Limite de concorrência não produtiva excedido.');
  }

  /** Reserva concorrência + incrementa a quota diária (chamar após o preflight passar). */
  acquire(organizationId: string, dayKey: string): void {
    this.concurrent += 1;
    const bucket = this.dailyCalls.get(organizationId);
    if (bucket && bucket.dayKey === dayKey) bucket.count += 1;
    else this.dailyCalls.set(organizationId, { dayKey, count: 1 });
  }

  release(): void {
    if (this.concurrent > 0) this.concurrent -= 1;
  }

  recordSuccess(): void {
    this.failures = 0;
    this.openedAtMs = null;
  }

  recordFailure(nowMs: number): void {
    this.failures += 1;
    if (this.failures >= this.config.ANTHROPIC_CIRCUIT_BREAKER_THRESHOLD) this.openedAtMs = nowMs;
  }

  maxOutputTokens(): number {
    return this.config.ANTHROPIC_NON_PROD_MAX_OUTPUT_TOKENS;
  }

  /** Somente para testes: zera o estado in-memory. */
  resetState(): void {
    this.failures = 0;
    this.openedAtMs = null;
    this.dailyCalls.clear();
    this.concurrent = 0;
  }
}
