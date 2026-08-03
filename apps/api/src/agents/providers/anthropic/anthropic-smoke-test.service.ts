/**
 * Arden.AS API — smoke test real controlado do Anthropic (ARDEN-BE-008.4 §8-27).
 *
 * Executa UMA chamada mínima pela ARQUITETURA NORMAL (provider → cofre → transporte), com
 * payload SINTÉTICO, tools=[], tokens baixos e timeout curto. Resultado SANITIZADO (nunca
 * chave/prompt/raw/headers/requestId bruto). Custo permanece null (sem rate card). Em PASSED,
 * vincula a verificação de smoke À VERSÃO de credencial (rotação invalida). Auditoria mínima.
 */

import { createHash } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { ModelGenerationRequest, ModelGenerationContext } from '@arden/contracts';
import { isAllowedAnthropicModelId, ANTHROPIC_PROVIDER_KEY, ANTHROPIC_PROVIDER_VERSION } from '@arden/contracts';
import { APP_CONFIG } from '../../../config/config.module';
import type { AppConfig } from '../../../config/env.schema';
import { PrismaService } from '../../../database/prisma.service';
import { AuditRecorder } from '../../../audit/audit.recorder';
import { ModelConfigurationsRepository } from '../../model-configurations/model-configurations.repository';
import { ConnectionCredentialVersionsRepository } from '../../../connectors/connections/connections.repository';
import { validateAgainstSchema } from '../../../connectors/tools/json-schema-validator';
import { ModelProviderInvocationError } from '../../runtime/model-provider.errors';
import { ApiException } from '../../../common/errors/api-error';
import { AnthropicModelProvider } from './anthropic-model-provider';
import { AnthropicNonProdGate } from './anthropic-non-prod-gate';

export type AnthropicSmokeStatus = 'PASSED' | 'FAILED' | 'UNKNOWN';

export interface AnthropicSmokeTestResult {
  status: AnthropicSmokeStatus;
  organizationId: string;
  connectionId: string;
  modelConfigurationId: string;
  providerKey: string;
  modelId: string;
  authenticationValidated: boolean;
  structuredOutputValidated: boolean;
  inputTokens: number | null;
  outputTokens: number | null;
  cachedInputTokens: number | null;
  estimatedCostMinor: null;
  currency: null;
  requestIdHash: string | null;
  responseHash: string | null;
  errorCode: string | null;
  durationMs: number;
  performedAt: string;
}

export interface AnthropicSmokeTestInput {
  organizationId: string;
  connectionId: string;
  modelConfigurationId: string;
  confirmed: boolean;
  operator: string;
  correlationId?: string;
}

const SMOKE_OUTPUT_SCHEMA: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  required: ['status', 'provider'],
  properties: { status: { type: 'string', enum: ['ok'] }, provider: { type: 'string' } },
};
const SMOKE_TASK = 'Return a structured health check response with status "ok".';

const sha256 = (v: unknown): string => createHash('sha256').update(typeof v === 'string' ? v : JSON.stringify(v ?? null)).digest('hex');

@Injectable()
export class AnthropicSmokeTestService {
  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly provider: AnthropicModelProvider,
    private readonly gate: AnthropicNonProdGate,
    private readonly prisma: PrismaService,
    private readonly configs: ModelConfigurationsRepository,
    private readonly credentials: ConnectionCredentialVersionsRepository,
    private readonly audit: AuditRecorder,
  ) {}

  /** Gates de execução do comando (§9/§10). Lança erro tipado se qualquer condição falhar. */
  assertCommandAllowed(input: AnthropicSmokeTestInput): void {
    if ((process.env.NODE_ENV ?? this.config.NODE_ENV) === 'production') throw new SmokeGateError('MODEL_PROVIDER_DISABLED', 'Smoke test proibido em produção.');
    if (!this.config.ANTHROPIC_PROVIDER_RUNTIME_ENABLED) throw new SmokeGateError('SMOKE_TEST_DISABLED', 'Runtime do provider desabilitado.');
    if (!this.config.ANTHROPIC_PROVIDER_EXTERNAL_CALLS_ENABLED) throw new SmokeGateError('SMOKE_TEST_DISABLED', 'Chamadas externas desabilitadas.');
    if (!this.config.ANTHROPIC_SMOKE_TEST_ENABLED) throw new SmokeGateError('SMOKE_TEST_DISABLED', 'Smoke test desabilitado.');
    if (!this.config.ANTHROPIC_SMOKE_TEST_ACKNOWLEDGED) throw new SmokeGateError('SMOKE_TEST_DISABLED', 'Smoke test não reconhecido pelo operador.');
    if (!input.confirmed) throw new SmokeGateError('SMOKE_TEST_CONFIRMATION_REQUIRED', 'Confirmação explícita ausente.');
    if (!input.organizationId) throw new SmokeGateError('VALIDATION_ERROR', 'organizationId obrigatório.');
    if (!input.connectionId) throw new SmokeGateError('VALIDATION_ERROR', 'connectionId obrigatório.');
    if (!input.modelConfigurationId) throw new SmokeGateError('VALIDATION_ERROR', 'modelConfigurationId obrigatório.');
    if (!this.gate.isOrgAllowed(input.organizationId)) throw new SmokeGateError('MODEL_PROVIDER_DISABLED', 'Organização não autorizada.');
  }

  async run(input: AnthropicSmokeTestInput): Promise<AnthropicSmokeTestResult> {
    this.assertCommandAllowed(input);
    const correlationId = input.correlationId ?? 'anthropic-smoke';
    const performedAt = new Date();
    const startedMs = Date.now();

    // Config Anthropic tenant-scoped: modelId allowlisted + conexão vinculada.
    const cfg = await this.configs.findById(input.organizationId, input.modelConfigurationId);
    if (!cfg || cfg.providerDefinitionId == null) throw new SmokeGateError('MODEL_CONFIGURATION_NOT_FOUND', 'Configuração não encontrada.');
    if (cfg.credentialConnectionId !== input.connectionId) throw new SmokeGateError('VALIDATION_ERROR', 'Conexão não corresponde à configuração.');
    if (!isAllowedAnthropicModelId(cfg.modelId)) throw new SmokeGateError('VALIDATION_ERROR', 'modelId não allowlisted.');

    const activeVersion = await this.credentials.findActive(input.organizationId, input.connectionId);
    const credentialVersionId = activeVersion?.id ?? null;

    await this.recordAudit(input, 'anthropic.smoke_test_requested', 'SUCCESS', { modelId: cfg.modelId, credentialVersionId });

    const request: ModelGenerationRequest = {
      providerKey: ANTHROPIC_PROVIDER_KEY, providerVersion: ANTHROPIC_PROVIDER_VERSION, modelId: cfg.modelId,
      systemInstructions: SMOKE_TASK,
      messages: [{ role: 'USER', content: [{ type: 'TEXT', text: '{"request_id":"smoke-test"}' }] }],
      tools: [], outputSchema: SMOKE_OUTPUT_SCHEMA,
      maximumInputTokens: 1000, maximumOutputTokens: this.gate.maxOutputTokens(), correlationId,
    } as ModelGenerationRequest;
    const context: ModelGenerationContext = {
      organizationId: input.organizationId, modelConfigurationId: input.modelConfigurationId,
      credentialConnectionId: input.connectionId, correlationId, deadlineMs: 20_000, smokeTest: true,
    };
    await this.recordAudit(input, 'anthropic.smoke_test_preflight_passed', 'SUCCESS', { modelId: cfg.modelId });

    const base = {
      organizationId: input.organizationId, connectionId: input.connectionId, modelConfigurationId: input.modelConfigurationId,
      providerKey: ANTHROPIC_PROVIDER_KEY, modelId: cfg.modelId,
      estimatedCostMinor: null as null, currency: null as null,
      requestIdHash: null as string | null, responseHash: null as string | null,
      inputTokens: null as number | null, outputTokens: null as number | null, cachedInputTokens: null as number | null,
    };

    try {
      await this.recordAudit(input, 'anthropic.smoke_test_started', 'SUCCESS', { modelId: cfg.modelId });
      const result = await this.provider.generate(request, context);
      const violations = validateAgainstSchema(result.structuredOutput, SMOKE_OUTPUT_SCHEMA as Record<string, unknown>);
      const structuredOutputValidated = result.finishReason === 'STOP' && violations.length === 0;
      const durationMs = Date.now() - startedMs;
      const out: AnthropicSmokeTestResult = {
        ...base, status: structuredOutputValidated ? 'PASSED' : 'FAILED',
        authenticationValidated: true, structuredOutputValidated,
        inputTokens: result.usage.inputTokens, outputTokens: result.usage.outputTokens, cachedInputTokens: result.usage.cachedInputTokens ?? null,
        requestIdHash: result.providerRequestId ? sha256(result.providerRequestId) : null,
        responseHash: sha256({ finish: result.finishReason, output: result.structuredOutput }),
        errorCode: structuredOutputValidated ? null : 'AGENT_OUTPUT_SCHEMA_INVALID',
        durationMs, performedAt: performedAt.toISOString(),
      };
      if (out.status === 'PASSED' && credentialVersionId) await this.markSmokeVerified(credentialVersionId, cfg.modelId, performedAt);
      await this.recordAudit(input, out.status === 'PASSED' ? 'anthropic.smoke_test_succeeded' : 'anthropic.smoke_test_failed', out.status === 'PASSED' ? 'SUCCESS' : 'FAILURE', this.auditMeta(out, credentialVersionId));
      return out;
    } catch (err) {
      const errorCode = this.classify(err);
      const status: AnthropicSmokeStatus = errorCode === 'MODEL_RESULT_UNKNOWN' ? 'UNKNOWN' : 'FAILED';
      const out: AnthropicSmokeTestResult = {
        ...base, status, authenticationValidated: errorCode !== 'MODEL_PROVIDER_ERROR' && errorCode !== 'MODEL_PROVIDER_DISABLED',
        structuredOutputValidated: false, errorCode, durationMs: Date.now() - startedMs, performedAt: performedAt.toISOString(),
      };
      await this.recordAudit(input, status === 'UNKNOWN' ? 'anthropic.smoke_test_unknown' : 'anthropic.smoke_test_failed', 'FAILURE', this.auditMeta(out, credentialVersionId));
      return out;
    }
  }

  private async markSmokeVerified(credentialVersionId: string, modelId: string, at: Date): Promise<void> {
    const row = await this.prisma.connectionCredentialVersion.findFirst({ where: { id: credentialVersionId }, select: { metadata: true } });
    const metadata = { ...((row?.metadata as Record<string, unknown>) ?? {}), smokeTest: { status: 'PASSED', credentialVersionId, modelId, at: at.toISOString() } };
    await this.prisma.connectionCredentialVersion.update({ where: { id: credentialVersionId }, data: { metadata } });
  }

  private classify(err: unknown): string {
    if (err instanceof ModelProviderInvocationError) {
      return err.kind === 'TIMEOUT' ? 'AGENT_TIMEOUT' : err.kind === 'RATE_LIMIT' ? 'MODEL_RATE_LIMITED' : err.kind === 'UNKNOWN' ? 'MODEL_RESULT_UNKNOWN' : 'MODEL_PROVIDER_ERROR';
    }
    if (err instanceof ApiException) return err.code;
    if (err instanceof SmokeGateError) return err.code;
    return 'MODEL_PROVIDER_ERROR';
  }

  private auditMeta(out: AnthropicSmokeTestResult, credentialVersionId: string | null): Record<string, unknown> {
    return {
      status: out.status, modelId: out.modelId, connectionId: out.connectionId, modelConfigurationId: out.modelConfigurationId,
      credentialVersionId, requestIdHash: out.requestIdHash, responseHash: out.responseHash,
      inputTokens: out.inputTokens, outputTokens: out.outputTokens, durationMs: out.durationMs, errorCode: out.errorCode,
    };
  }

  private async recordAudit(input: AnthropicSmokeTestInput, action: string, outcome: 'SUCCESS' | 'FAILURE', metadata: Record<string, unknown>): Promise<void> {
    await this.prisma.$transaction((tx) =>
      this.audit.record(tx, {
        organizationId: input.organizationId, actorUserId: null, action,
        resourceType: 'organization_connection', resourceId: input.connectionId, outcome,
        correlationId: input.correlationId ?? 'anthropic-smoke', metadata: { ...metadata, operator: input.operator },
      }),
    );
  }
}

/** Erro de gate do smoke (código canônico ou sentinela de gate; nunca vaza segredo). */
export class SmokeGateError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = 'SmokeGateError';
  }
}
