/**
 * Arden.AS — API v1 · resultado operacional, usage e custo do agente (ARDEN-BE-007.6).
 *
 * Resultado CONSOLIDADO e consultável de cada execução `agent.execute`: status,
 * avaliação determinística, usage de modelos/tools, custo estimado e governança. NUNCA
 * expõe prompt/contexto/output completo/segredo — apenas status, contadores, tokens,
 * hashes e custo em unidade menor (inteiro). Não é billing.
 */

import { z } from 'zod';
import { modelProviderKey, modelProviderVersion, modelId } from './agent-keys';
import { currencyCode } from './agent-cost-policy.schema';

// ── Enums de status ──────────────────────────────────────────────────────────────
export const agentResultStatus = z.enum(['SUCCEEDED', 'FAILED', 'SUSPENDED', 'REQUIRES_APPROVAL', 'UNKNOWN']);
export type AgentResultStatus = z.infer<typeof agentResultStatus>;

export const agentOutputValidationStatus = z.enum(['VALID', 'INVALID', 'NOT_AVAILABLE']);
export type AgentOutputValidationStatus = z.infer<typeof agentOutputValidationStatus>;

export const agentEvaluationStatusEnum = z.enum(['PASSED', 'FAILED', 'PARTIAL', 'NOT_RUN']);
export type AgentEvaluationStatusEnum = z.infer<typeof agentEvaluationStatusEnum>;

export const agentGovernanceStatus = z.enum(['WITHIN_LIMITS', 'LIMIT_WARNING', 'LIMIT_EXCEEDED', 'BLOCKED']);
export type AgentGovernanceStatus = z.infer<typeof agentGovernanceStatus>;

export const agentModelCallPurpose = z.enum(['PRIMARY', 'OUTPUT_REPAIR', 'TOOL_CONTINUATION', 'EVALUATION']);
export type AgentModelCallPurpose = z.infer<typeof agentModelCallPurpose>;

// ── Check de avaliação determinística ────────────────────────────────────────────
export const deterministicEvaluationCheckResult = z.object({
  key: z.string().min(1).max(80),
  status: z.enum(['PASSED', 'FAILED', 'SKIPPED']),
  severity: z.enum(['INFO', 'WARNING', 'ERROR', 'CRITICAL']),
  code: z.string().max(120).optional(),
  summary: z.string().max(300).optional(),
  evidenceReferenceIds: z.array(z.string().min(1).max(128)).max(100),
});
export type DeterministicEvaluationCheckResult = z.infer<typeof deterministicEvaluationCheckResult>;

// ── Resumos ──────────────────────────────────────────────────────────────────────
export const agentUsageSummary = z.object({
  providerKey: modelProviderKey,
  modelId,
  modelCallCount: z.number().int().min(0),
  toolCallCount: z.number().int().min(0),
  turnCount: z.number().int().min(0),
  repairAttemptCount: z.number().int().min(0),
  approvalCount: z.number().int().min(0),
  securitySignalCount: z.number().int().min(0),
  inputTokens: z.number().int().min(0),
  outputTokens: z.number().int().min(0),
  cachedInputTokens: z.number().int().min(0),
  cachedOutputTokens: z.number().int().min(0),
  durationMs: z.number().int().min(0),
});
export type AgentUsageSummary = z.infer<typeof agentUsageSummary>;

export const agentCostSummary = z.object({
  /** Custo estimado em unidade menor (inteiro). Nulo = sem rate card conhecida. */
  estimatedCostMinor: z.number().int().min(0).nullable(),
  currency: currencyCode.nullable(),
  rateCardId: z.string().max(64).nullable(),
  /** Warning operacional (ex.: COST_RATE_CARD_NOT_AVAILABLE) quando aplicável. */
  warningCode: z.string().max(120).nullable(),
});
export type AgentCostSummary = z.infer<typeof agentCostSummary>;

export const agentEvaluationSummary = z.object({
  status: agentEvaluationStatusEnum,
  policyHash: z.string().max(128).nullable(),
  checks: z.array(deterministicEvaluationCheckResult).max(100),
});
export type AgentEvaluationSummary = z.infer<typeof agentEvaluationSummary>;

// ── Resultado operacional (resposta HTTP) ────────────────────────────────────────
export const agentOperationalResult = z.object({
  id: z.string(),
  organizationId: z.string(),
  executionRunId: z.string(),
  executionStepId: z.string(),
  operationId: z.string(),
  operationVersionId: z.string(),
  agentDefinitionId: z.string(),
  agentVersionId: z.string(),

  status: agentResultStatus,
  outputValidationStatus: agentOutputValidationStatus,
  evaluationStatus: agentEvaluationStatusEnum,
  governanceStatus: agentGovernanceStatus,

  usageSummary: agentUsageSummary,
  costSummary: agentCostSummary,
  evaluationSummary: agentEvaluationSummary,

  outputHash: z.string().max(128).nullable(),
  contextHash: z.string().max(128).nullable(),
  evidenceReferenceIds: z.array(z.string().min(1).max(128)).max(200),

  startedAt: z.string().nullable(),
  completedAt: z.string().nullable(),
  durationMs: z.number().int().min(0),
  createdAt: z.string(),
});
export type AgentOperationalResult = z.infer<typeof agentOperationalResult>;

// ── Uso agregado (resposta HTTP de /agent-usage) ─────────────────────────────────
export const agentUsageRollupDimension = z.enum([
  'ORGANIZATION', 'OPERATION', 'OPERATION_VERSION', 'AGENT_DEFINITION', 'AGENT_VERSION', 'MODEL_CONFIGURATION', 'PROVIDER', 'MODEL',
]);
export type AgentUsageRollupDimension = z.infer<typeof agentUsageRollupDimension>;

export const agentUsageBucket = z.object({
  dimensionType: agentUsageRollupDimension,
  dimensionId: z.string(),
  periodDate: z.string(),
  providerKey: modelProviderKey,
  modelId,
  currency: currencyCode,
  executionCount: z.number().int().min(0),
  succeededCount: z.number().int().min(0),
  failedCount: z.number().int().min(0),
  suspendedCount: z.number().int().min(0),
  unknownCount: z.number().int().min(0),
  modelCallCount: z.number().int().min(0),
  toolCallCount: z.number().int().min(0),
  inputTokens: z.number().int().min(0),
  outputTokens: z.number().int().min(0),
  estimatedCostMinor: z.number().int().min(0),
  durationMs: z.number().int().min(0),
  approvalCount: z.number().int().min(0),
  criticalSignalCount: z.number().int().min(0),
});
export type AgentUsageBucket = z.infer<typeof agentUsageBucket>;

// ── Rate card (interno, system-managed) ─────────────────────────────────────────
// (nota) `agentToolRiskLevel` vive em `agent-keys`; não é re-exportado aqui.
export const modelRateCard = z.object({
  id: z.string(),
  providerKey: modelProviderKey,
  providerVersion: modelProviderVersion,
  modelId,
  currency: currencyCode,
  inputCostPerMillionTokensMinor: z.number().int().min(0),
  outputCostPerMillionTokensMinor: z.number().int().min(0),
  cachedInputCostPerMillionTokensMinor: z.number().int().min(0),
  cachedOutputCostPerMillionTokensMinor: z.number().int().min(0),
  status: z.enum(['ACTIVE', 'RETIRED']),
  source: z.string().max(40),
  catalogHash: z.string().max(128),
});
export type ModelRateCard = z.infer<typeof modelRateCard>;
