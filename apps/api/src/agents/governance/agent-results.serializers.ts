/**
 * Arden.AS API — serialização de resultados/uso operacional (ARDEN-BE-007.6 §26).
 * DB → contrato, com custo em INTEIRO (BigInt→number) e SEM conteúdo/segredo.
 */

import type { AgentExecutionResult as DbResult, AgentUsageRollup as DbRollup } from '@prisma/client';
import {
  agentOperationalResult,
  agentUsageBucket,
  type AgentOperationalResult,
  type AgentUsageBucket,
  type AgentEvaluationSummary,
} from '@arden/contracts';

const n = (v: bigint | number | null): number => (v == null ? 0 : Number(v));

export function toOperationalResultContract(row: DbResult): AgentOperationalResult {
  const gov = (row.governanceSummary ?? {}) as Record<string, unknown>;
  const cost = (gov.cost ?? {}) as Record<string, unknown>;
  const evaluation = (row.evaluationSummary ?? { status: row.evaluationStatus, policyHash: null, checks: [] }) as unknown as AgentEvaluationSummary;
  return agentOperationalResult.parse({
    id: row.id,
    organizationId: row.organizationId,
    executionRunId: row.executionRunId,
    executionStepId: row.executionStepId,
    operationId: row.operationId,
    operationVersionId: row.operationVersionId,
    agentDefinitionId: row.agentDefinitionId,
    agentVersionId: row.agentVersionId,
    status: row.status,
    outputValidationStatus: row.outputValidationStatus,
    evaluationStatus: row.evaluationStatus,
    governanceStatus: row.governanceStatus,
    usageSummary: {
      providerKey: row.providerKey,
      modelId: row.modelId,
      modelCallCount: row.modelCallCount,
      toolCallCount: row.toolCallCount,
      turnCount: row.turnCount,
      repairAttemptCount: row.repairAttemptCount,
      approvalCount: row.approvalCount,
      securitySignalCount: row.securitySignalCount,
      inputTokens: row.inputTokens,
      outputTokens: row.outputTokens,
      cachedInputTokens: row.cachedInputTokens,
      cachedOutputTokens: row.cachedOutputTokens,
      durationMs: row.durationMs,
    },
    costSummary: {
      estimatedCostMinor: row.estimatedCostMinor == null ? null : n(row.estimatedCostMinor),
      currency: row.currency,
      rateCardId: row.rateCardId,
      warningCode: (cost.warningCode as string) ?? null,
    },
    evaluationSummary: evaluation,
    outputHash: row.outputHash,
    contextHash: row.contextHash,
    evidenceReferenceIds: (row.evidenceReferenceIds as string[]) ?? [],
    startedAt: row.startedAt ? row.startedAt.toISOString() : null,
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
    durationMs: row.durationMs,
    createdAt: row.createdAt.toISOString(),
  });
}

export function toUsageBucketContract(row: DbRollup): AgentUsageBucket {
  return agentUsageBucket.parse({
    dimensionType: row.dimensionType,
    dimensionId: row.dimensionId,
    periodDate: row.periodDate.toISOString().slice(0, 10),
    providerKey: row.providerKey,
    modelId: row.modelId,
    currency: row.currency,
    executionCount: row.executionCount,
    succeededCount: row.succeededCount,
    failedCount: row.failedCount,
    suspendedCount: row.suspendedCount,
    unknownCount: row.unknownCount,
    modelCallCount: row.modelCallCount,
    toolCallCount: row.toolCallCount,
    inputTokens: n(row.inputTokens),
    outputTokens: n(row.outputTokens),
    estimatedCostMinor: n(row.estimatedCostMinor),
    durationMs: n(row.durationMs),
    approvalCount: row.approvalCount,
    criticalSignalCount: row.criticalSignalCount,
  });
}
