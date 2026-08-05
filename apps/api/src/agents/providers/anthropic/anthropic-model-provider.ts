/**
 * Arden.AS API — AnthropicModelProvider executável sob gate (ARDEN-BE-008.3 §18).
 *
 * Implementa o `ModelProvider` provider-neutro. Resolve a credencial tenant-scoped no cofre
 * (memória), mapeia o request canônico, chama o transporte (SDK real ou fake) com política de
 * retry PRÓPRIA (retry do SDK desabilitado), mapeia resposta/erro/usage e devolve o contrato
 * canônico. NÃO executa tools. Segredo nunca entra no request/log/erro; descartado ao final.
 */

import { Inject, Injectable } from '@nestjs/common';
import type { ModelProvider, ModelGenerationRequest, ModelGenerationResult, ModelGenerationContext } from '@arden/contracts';
import {
  ANTHROPIC_PROVIDER_KEY,
  ANTHROPIC_PROVIDER_VERSION,
  isAllowedAnthropicModelId,
  anthropicModelParameters,
} from '@arden/contracts';
import { ModelProviderInvocationError } from '../../runtime/model-provider.errors';
import { AgentMetrics } from '../../governance/agent-metrics';
import { PrismaService } from '../../../database/prisma.service';
import { AnthropicRequestMapper, type AnthropicRequestMapperOptions, ANTHROPIC_STRUCTURED_OUTPUT_TOOL } from './anthropic-request-mapper';
import { AnthropicResponseMapper } from './anthropic-response-mapper';
import { AnthropicToolDefinitionMapper } from './anthropic-tool-definition-mapper';
import type { AnthropicToolNameCodec } from './anthropic-tool-name-codec';
import { AnthropicErrorMapper, type AnthropicMappedError } from './anthropic-error-mapper';
import { decideAnthropicRetry, computeAnthropicBackoffMs, ANTHROPIC_RETRY_DEFAULT } from './anthropic-retry-policy';
import { ANTHROPIC_TRANSPORT, AnthropicTransportException, type AnthropicTransport } from './anthropic-transport.port';
import type { AnthropicTransportRequest } from './anthropic-transport.types';
import { AnthropicProviderCredentialResolver, type ResolvedAnthropicCredential } from './anthropic-provider-credential.resolver';
import { assertAnthropicSchemaCompatible } from './anthropic-schema-compatibility';
import { AnthropicNonProdGate } from './anthropic-non-prod-gate';
import { modelProviderDisabled } from '../../../common/errors/api-error';

const M_REQUESTS = 'arden_model_provider_requests_total';
const M_DURATION = 'arden_model_provider_request_duration_ms';
const M_ERRORS = 'arden_model_provider_errors_total';
const M_RATE = 'arden_model_provider_rate_limits_total';
const M_UNKNOWN = 'arden_model_provider_unknown_results_total';
const M_IN = 'arden_model_provider_input_tokens_total';
const M_OUT = 'arden_model_provider_output_tokens_total';

@Injectable()
export class AnthropicModelProvider implements ModelProvider {
  readonly key = ANTHROPIC_PROVIDER_KEY;
  readonly version = ANTHROPIC_PROVIDER_VERSION;

  private readonly requestMapper = new AnthropicRequestMapper();
  private readonly responseMapper = new AnthropicResponseMapper();
  private readonly errorMapper = new AnthropicErrorMapper();
  private readonly toolDefMapper = new AnthropicToolDefinitionMapper();

  constructor(
    @Inject(ANTHROPIC_TRANSPORT) private readonly transport: AnthropicTransport,
    private readonly credentials: AnthropicProviderCredentialResolver,
    private readonly prisma: PrismaService,
    private readonly metrics: AgentMetrics,
    private readonly nonProdGate: AnthropicNonProdGate,
  ) {}

  /** UTC day key para as quotas diárias (não usa relógio proibido — API normal). */
  private dayKey(nowMs: number): string {
    return new Date(nowMs).toISOString().slice(0, 10);
  }

  async generate(request: ModelGenerationRequest, context?: ModelGenerationContext): Promise<ModelGenerationResult> {
    if (!context) throw new ModelProviderInvocationError('PROVIDER_ERROR', 'Contexto de execução ausente.');
    const hasTools = (request.tools?.length ?? 0) > 0;
    // §37/§39: tool calling só fora de produção e sob o gate dedicado. Produção sempre bloqueia
    // ANTES de mapear tools/resolver credencial/tocar o transporte. Sem o gate → tools rejeitadas
    // (structured output continua funcionando).
    if (hasTools) {
      if (this.nonProdGate.isProduction()) throw modelProviderDisabled('Provider Anthropic bloqueado em produção.');
      if (!this.nonProdGate.toolCallingEnabled()) throw new ModelProviderInvocationError('PROVIDER_ERROR', 'Tool calling Anthropic desabilitado (gate).');
    }
    if (!isAllowedAnthropicModelId(request.modelId)) {
      throw new ModelProviderInvocationError('UNSUPPORTED_MODEL', 'modelId não allowlisted para anthropic.direct.');
    }
    // §25: compatibilidade do schema de saída (rejeita $ref externo, profundidade/tamanho).
    if (request.outputSchema) assertAnthropicSchemaCompatible(request.outputSchema);

    const labels = { provider: this.key, model: request.modelId };
    // Política de chamada REAL (ARDEN-BE-008.4): só quando o gate de chamadas externas está
    // ligado. Na demonstração offline (008.3, gate off) a política não se aplica.
    const realCall = this.nonProdGate.externalCallsEnabled();
    const nowMs = Date.now();
    const dayKey = this.dayKey(nowMs);
    let credential: ResolvedAnthropicCredential | null = null;
    let acquired = false;
    try {
      if (realCall) {
        // Bloqueia produção/allowlist/breaker ANTES de resolver a credencial (§16/§34).
        this.nonProdGate.assertRealCallAllowed(context.organizationId, nowMs, dayKey);
      }
      credential = await this.credentials.resolve({
        organizationId: context.organizationId,
        modelConfigurationId: context.modelConfigurationId,
        credentialConnectionId: context.credentialConnectionId,
        correlationId: context.correlationId,
      });
      if (realCall && !context.smokeTest && !credential.smokeVerified) {
        // Execução real normal exige smoke test válido para ESTA versão de credencial.
        throw modelProviderDisabled('Versão de credencial sem smoke test válido (ARDEN-BE-008.4).');
      }
      const opts = await this.parameterOptions(context.organizationId, context.modelConfigurationId);
      // §8/§12: mapeia as tools allowlisted (interseção server-side do 007.5) e mantém o codec
      // per-request para o reverse-lookup do tool_use e a síntese da continuação.
      let codec: AnthropicToolNameCodec | undefined;
      if (hasTools) {
        const mapping = this.toolDefMapper.map(request.tools ?? [], [ANTHROPIC_STRUCTURED_OUTPUT_TOOL]);
        opts.toolDefinitions = mapping.definitions;
        opts.toolCodec = mapping.codec;
        opts.toolChoice = 'AUTO';
        codec = mapping.codec;
      }
      const transportRequest = this.requestMapper.map(request, opts);
      if (realCall) {
        // Quota de tokens de saída (denial-of-wallet) não produtiva.
        transportRequest.max_tokens = Math.min(transportRequest.max_tokens, this.nonProdGate.maxOutputTokens());
        this.nonProdGate.acquire(context.organizationId, dayKey);
        acquired = true;
      }
      const timeoutMs = this.effectiveTimeout(context.deadlineMs, credential.timeoutMs);
      const result = await this.callWithRetry(request, transportRequest, credential.apiKey, timeoutMs, context, labels, codec);
      if (realCall) this.nonProdGate.recordSuccess();
      return result;
    } catch (err) {
      if (realCall) this.nonProdGate.recordFailure(Date.now());
      if (err instanceof ModelProviderInvocationError) throw err;
      throw this.toInvocationError(err);
    } finally {
      if (acquired) this.nonProdGate.release();
      // Descarte best-effort do plaintext (limitação de zeroização em JS — documentada).
      if (credential) credential.apiKey = '';
    }
  }

  private async callWithRetry(
    request: ModelGenerationRequest,
    transportRequest: AnthropicTransportRequest,
    apiKey: string,
    timeoutMs: number,
    context: ModelGenerationContext,
    labels: { provider: string; model: string },
    codec?: AnthropicToolNameCodec,
  ): Promise<ModelGenerationResult> {
    const startedAtAll = Date.now();
    const deadlineAt = context.deadlineMs && context.deadlineMs > 0 ? startedAtAll + context.deadlineMs : Number.MAX_SAFE_INTEGER;
    let attempt = 1;

    for (;;) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const startedAt = Date.now();
      this.metrics.increment(M_REQUESTS, { ...labels, status: 'started' });
      try {
        const response = await this.transport.createMessage(transportRequest, {
          apiKey, timeoutMs, maximumRetries: 0, signal: controller.signal, correlationId: context.correlationId,
        });
        clearTimeout(timer);
        const durationMs = Date.now() - startedAt;
        const result = this.responseMapper.map(response, request.modelId, codec);
        // Duração medida pelo provider; modelCallCount = tentativas realizadas.
        result.usage = { ...result.usage, durationMs, modelCallCount: attempt };
        this.metrics.increment(M_REQUESTS, { ...labels, status: 'succeeded' });
        this.metrics.observe(M_DURATION, durationMs, { ...labels, status: 'succeeded' });
        this.metrics.increment(M_IN, { ...labels }, result.usage.inputTokens);
        this.metrics.increment(M_OUT, { ...labels }, result.usage.outputTokens);
        return result;
      } catch (err) {
        clearTimeout(timer);
        if (!(err instanceof AnthropicTransportException)) throw this.toInvocationError(err);
        const mapped = this.applyPhase(this.errorMapper.map(err.transportError), err.transportError.phase);
        this.metrics.increment(M_ERRORS, { ...labels, error_code: mapped.ardenCode, retryable: String(mapped.retryable) });
        if (mapped.ardenCode === 'MODEL_RATE_LIMITED') this.metrics.increment(M_RATE, { ...labels });
        if (mapped.unknown) this.metrics.increment(M_UNKNOWN, { ...labels });

        const decision = decideAnthropicRetry(mapped, attempt, ANTHROPIC_RETRY_DEFAULT, deadlineAt - Date.now());
        if (!decision.retry) throw this.invocationFor(mapped);
        this.metrics.increment(M_REQUESTS, { ...labels, status: 'retried' });
        await this.sleep(computeAnthropicBackoffMs(attempt, ANTHROPIC_RETRY_DEFAULT, mapped.retryAfterMs), controller.signal);
        attempt += 1;
      }
    }
  }

  /** Falha BEFORE_SEND = seguro retriar (não incerto). AFTER_SEND/ausente = matriz. */
  private applyPhase(mapped: AnthropicMappedError, phase?: 'BEFORE_SEND' | 'AFTER_SEND'): AnthropicMappedError {
    if (phase === 'BEFORE_SEND') return { ...mapped, retryable: true, unknown: false };
    return mapped;
  }

  /** Erro mapeado → erro de invocação (kind que o runtime traduz para código de API). */
  private invocationFor(mapped: AnthropicMappedError): ModelProviderInvocationError {
    if (mapped.unknown) return new ModelProviderInvocationError('UNKNOWN', 'Resultado incerto do provider.');
    if (mapped.ardenCode === 'MODEL_RATE_LIMITED') return new ModelProviderInvocationError('RATE_LIMIT', 'Provider limitou a taxa.');
    if (mapped.ardenCode === 'AGENT_TIMEOUT') return new ModelProviderInvocationError('TIMEOUT', 'Provider excedeu o tempo.');
    return new ModelProviderInvocationError('PROVIDER_ERROR', 'Falha do provider.');
  }

  private toInvocationError(err: unknown): ModelProviderInvocationError {
    if (err instanceof AnthropicTransportException) return this.invocationFor(this.applyPhase(this.errorMapper.map(err.transportError), err.transportError.phase));
    // Falha de resolução de credencial / compat / interna → erro seguro (sem detalhe).
    return new ModelProviderInvocationError('PROVIDER_ERROR', 'Falha ao preparar a chamada ao provider.');
  }

  private async parameterOptions(organizationId: string, modelConfigurationId: string): Promise<AnthropicRequestMapperOptions> {
    const row = await this.prisma.modelConfiguration.findFirst({ where: { id: modelConfigurationId, organizationId }, select: { parameters: true } });
    const parsed = anthropicModelParameters.safeParse(row?.parameters ?? {});
    if (!parsed.success) return {};
    return { temperature: parsed.data.temperature, topP: parsed.data.topP, stopSequences: parsed.data.stopSequences };
  }

  private effectiveTimeout(deadlineMs: number | undefined, connectionTimeoutMs: number): number {
    const candidates = [connectionTimeoutMs];
    if (deadlineMs && deadlineMs > 0) candidates.push(deadlineMs);
    return Math.max(1, Math.min(...candidates));
  }

  private sleep(ms: number, signal: AbortSignal): Promise<void> {
    if (ms <= 0) return Promise.resolve();
    return new Promise((resolve) => {
      const t = setTimeout(resolve, ms);
      signal.addEventListener('abort', () => { clearTimeout(t); resolve(); }, { once: true });
    });
  }
}
