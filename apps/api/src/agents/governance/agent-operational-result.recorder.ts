/**
 * Arden.AS API — persistência do resultado operacional do agente (ARDEN-BE-007.6 §5–§35).
 *
 * Orquestra avaliação determinística + agregação de usage + estimativa de custo +
 * governança e PERSISTE (idempotente): agent_execution_results (unique por etapa),
 * agent_model_call_usage, agent_tool_call_usage e os rollups diários. Emite auditoria,
 * evidência e métricas — tudo SANITIZADO (hashes/contadores; nunca prompt/output/segredo).
 * Rollups e auditoria terminal contam UMA vez por execução (transição para terminal).
 */

import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AgentResultStatus } from '@arden/contracts';
import { PrismaService } from '../../database/prisma.service';
import { AuditRecorder } from '../../audit/audit.recorder';
import { ExecutionRecorder } from '../../executions/execution.recorder';
import type { AgentRuntimeOutcome } from '../runtime/agent-runtime.types';
import { AgentUsageAggregator } from './agent-usage-aggregator';
import { AgentCostEstimator, type RateCardRates } from './agent-cost-estimator';
import { AgentEvaluationEngine } from './agent-evaluation-engine';
import { AgentGovernanceEvaluator } from './agent-governance-evaluator';
import { AgentMetrics } from './agent-metrics';
import { ModelRateCardsRepository } from './rate-card.projector';

const TERMINAL = new Set<string>(['SUCCEEDED', 'FAILED', 'UNKNOWN']);
const REACHED_EVAL_ERRORS = new Set(['AGENT_OUTPUT_INVALID', 'AGENT_OUTPUT_REPAIR_EXHAUSTED', 'AGENT_EVALUATION_FAILED']);
const INVALID_OUTPUT_ERRORS = new Set(['AGENT_OUTPUT_INVALID', 'AGENT_OUTPUT_REPAIR_EXHAUSTED']);

const ROLLUP_DIMENSIONS = ['ORGANIZATION', 'OPERATION', 'OPERATION_VERSION', 'AGENT_DEFINITION', 'AGENT_VERSION', 'MODEL_CONFIGURATION', 'PROVIDER', 'MODEL'] as const;

export interface RecordResultInput {
  organizationId: string;
  executionRunId: string;
  executionStepId: string;
  operationId: string;
  operationVersionId: string;
  correlationId: string;
  startedAt: Date;
  now: Date;
  outcome: AgentRuntimeOutcome;
}

@Injectable()
export class AgentOperationalResultRecorder {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aggregator: AgentUsageAggregator,
    private readonly costEstimator: AgentCostEstimator,
    private readonly evaluationEngine: AgentEvaluationEngine,
    private readonly governance: AgentGovernanceEvaluator,
    private readonly metrics: AgentMetrics,
    private readonly rateCards: ModelRateCardsRepository,
    private readonly audit: AuditRecorder,
    private readonly recorder: ExecutionRecorder,
  ) {}

  async record(input: RecordResultInput): Promise<void> {
    const ev = input.outcome.evidence as Record<string, unknown>;
    const result = input.outcome.result;
    const gov = (ev.governance ?? {}) as Record<string, unknown>;
    const status = result.status as AgentResultStatus;
    const errorCode = (result.errorCode ?? null) as string | null;

    const providerKey = String(ev.providerKey ?? 'unknown');
    const providerVersion = String(ev.providerVersion ?? '1');
    const modelId = String(ev.modelId ?? 'unknown');
    const agentDefinitionId = String(ev.agentDefinitionId);
    const agentVersionId = String(ev.agentVersionId);
    const modelConfigurationId = String(ev.modelConfigurationId ?? agentVersionId);

    const signals = Array.isArray(ev.securitySignals) ? (ev.securitySignals as Array<Record<string, unknown>>) : [];
    const criticalSignalCount = signals.filter((s) => s.severity === 'CRITICAL' || s.blocked === true).length;
    const nonCriticalSignalCount = signals.length - criticalSignalCount;

    // ── Usage ──────────────────────────────────────────────────────────────────
    const agg = this.aggregator.aggregate({
      providerKey, modelId,
      modelCalls: input.outcome.modelCalls, toolCalls: input.outcome.toolCalls,
      turnCount: result.turnCount, repairAttemptCount: Number(ev.repairAttemptCount ?? 0),
      approvalCount: input.outcome.toolCalls.filter((t) => t.authorizationId).length,
      securitySignalCount: signals.length, durationMs: result.durationMs,
    });
    const usage = agg.summary;

    // ── Custo (rate card ativa; ausente → null + warning) ────────────────────────
    const card = await this.rateCards.findActive(providerKey, providerVersion, modelId);
    const rate: RateCardRates | null = card ? {
      currency: card.currency, rateCardId: card.id,
      inputPerMillion: Number(card.inputCostPerMillionTokensMinor), outputPerMillion: Number(card.outputCostPerMillionTokensMinor),
      cachedInputPerMillion: Number(card.cachedInputCostPerMillionTokensMinor), cachedOutputPerMillion: Number(card.cachedOutputCostPerMillionTokensMinor),
    } : null;
    // Custo por chamada (soma → custo do resultado; ceil por componente).
    const perCall = input.outcome.modelCalls.map((c) => this.costEstimator.estimate(c, rate));
    const totalCost = rate ? perCall.reduce((acc, c) => acc + (c.estimatedCostMinor ?? 0), 0) : null;
    const costSummary = { estimatedCostMinor: totalCost, currency: rate ? rate.currency : null, rateCardId: rate ? rate.rateCardId : null, warningCode: rate ? null : 'COST_RATE_CARD_NOT_AVAILABLE' };

    // ── Avaliação determinística ─────────────────────────────────────────────────
    const reachedEvaluation = status === 'SUCCEEDED' || (errorCode != null && REACHED_EVAL_ERRORS.has(errorCode));
    const evaluation = this.evaluationEngine.evaluate({
      reachedEvaluation,
      outputSchemaValid: status === 'SUCCEEDED' ? true : errorCode && INVALID_OUTPUT_ERRORS.has(errorCode) ? false : null,
      outputEvaluationPassed: status === 'SUCCEEDED' ? true : errorCode === 'AGENT_EVALUATION_FAILED' ? false : null,
      requireEvidenceReferences: Boolean(gov.requireEvidenceReferences),
      evidenceReferenceIds: input.outcome.toolCalls.flatMap((t) => (t.outputHash ? [t.outputHash] : [])),
      turnCount: result.turnCount, maxTurns: Number(gov.maxTurns ?? result.turnCount),
      toolCallCount: result.toolCallCount, maxToolCalls: Number(gov.maxToolCalls ?? result.toolCallCount),
      durationMs: result.durationMs, maxDurationMs: Number(gov.maxDurationMs ?? 0),
      criticalSignalCount, nonCriticalSignalCount,
      hadUnknownResult: status === 'UNKNOWN' || errorCode === 'MODEL_RESULT_UNKNOWN',
      hadDeniedToolCall: input.outcome.toolCalls.some((t) => t.status === 'DENIED'),
      pendingApproval: status === 'REQUIRES_APPROVAL' || status === 'SUSPENDED',
      policyHash: (gov.policyHash as string) ?? null,
    });

    // ── Governança ───────────────────────────────────────────────────────────────
    const governanceDecision = this.governance.evaluate({
      resultStatus: status, errorCode,
      costPolicy: { maximumEstimatedCostMinor: (gov.maximumEstimatedCostMinor as number) ?? null, currency: (gov.costCurrency as string) ?? null, maximumInputTokens: Number(gov.maximumInputTokens ?? 1), maximumOutputTokens: 1, maximumToolCalls: Number(gov.maxToolCalls ?? 0), actionOnLimit: (gov.actionOnLimit as 'FAIL' | 'SUSPEND' | 'REQUIRE_APPROVAL') ?? 'FAIL' },
      inputTokens: usage.inputTokens, toolCallCount: usage.toolCallCount, turnCount: usage.turnCount,
      estimatedCostMinor: costSummary.estimatedCostMinor, criticalSignalCount,
    });

    const outputValidationStatus = status === 'SUCCEEDED' ? 'VALID' : errorCode && INVALID_OUTPUT_ERRORS.has(errorCode) ? 'INVALID' : 'NOT_AVAILABLE';
    const rollupCurrency = costSummary.currency ?? 'XXX';

    // ── Persistência idempotente ────────────────────────────────────────────────
    const existing = await this.prisma.agentExecutionResult.findFirst({ where: { organizationId: input.organizationId, executionStepId: input.executionStepId }, select: { id: true, status: true } });
    const wasTerminal = existing ? TERMINAL.has(existing.status) : false;
    const emitTerminal = TERMINAL.has(status) && !wasTerminal;
    const firstRecord = !existing;

    const evidenceRefs = Array.isArray(result.evidenceReferenceIds) ? result.evidenceReferenceIds : [];

    await this.prisma.$transaction(async (tx) => {
      const resultData = {
        organizationId: input.organizationId, executionRunId: input.executionRunId,
        operationId: input.operationId, operationVersionId: input.operationVersionId,
        agentDefinitionId, agentVersionId,
        status, outputValidationStatus, evaluationStatus: evaluation.status, governanceStatus: governanceDecision.status,
        outputHash: (ev.outputHash as string) ?? null, contextHash: (ev.contextHash as string) ?? null,
        modelCallCount: usage.modelCallCount, toolCallCount: usage.toolCallCount, turnCount: usage.turnCount,
        repairAttemptCount: usage.repairAttemptCount, approvalCount: usage.approvalCount, securitySignalCount: usage.securitySignalCount,
        inputTokens: usage.inputTokens, outputTokens: usage.outputTokens, cachedInputTokens: usage.cachedInputTokens, cachedOutputTokens: usage.cachedOutputTokens,
        estimatedCostMinor: costSummary.estimatedCostMinor == null ? null : BigInt(costSummary.estimatedCostMinor),
        currency: costSummary.currency, rateCardId: costSummary.rateCardId,
        providerKey, modelId,
        evaluationSummary: evaluation as unknown as Prisma.InputJsonValue,
        governanceSummary: { ...governanceDecision, cost: costSummary } as unknown as Prisma.InputJsonValue,
        evidenceReferenceIds: evidenceRefs as unknown as Prisma.InputJsonValue,
        startedAt: input.startedAt, completedAt: TERMINAL.has(status) ? input.now : null, durationMs: usage.durationMs,
      };
      await tx.agentExecutionResult.upsert({
        where: { executionStepId: input.executionStepId },
        create: { executionStepId: input.executionStepId, ...resultData } as Prisma.AgentExecutionResultUncheckedCreateInput,
        update: { ...resultData, revision: { increment: 1 } } as Prisma.AgentExecutionResultUncheckedUpdateInput,
      });

      for (const c of input.outcome.modelCalls) {
        const cost = this.costEstimator.estimate(c, rate);
        await tx.agentModelCallUsage.upsert({
          where: { uniq_model_call_per_step: { executionStepId: input.executionStepId, callIndex: c.callIndex } },
          create: {
            organizationId: input.organizationId, executionRunId: input.executionRunId, executionStepId: input.executionStepId,
            agentDefinitionId, agentVersionId, modelConfigurationId, providerKey, providerVersion, modelId,
            callIndex: c.callIndex, purpose: c.purpose, status: c.status, finishReason: c.finishReason,
            inputTokens: c.inputTokens, outputTokens: c.outputTokens, cachedInputTokens: c.cachedInputTokens, cachedOutputTokens: c.cachedOutputTokens,
            estimatedCostMinor: cost.estimatedCostMinor == null ? null : BigInt(cost.estimatedCostMinor), currency: cost.currency, rateCardId: cost.rateCardId,
            requestHash: c.requestHash, responseHash: c.responseHash, durationMs: c.durationMs,
          },
          update: { status: c.status, finishReason: c.finishReason },
        });
      }
      for (const t of input.outcome.toolCalls) {
        await tx.agentToolCallUsage.upsert({
          where: { uniq_tool_call_per_step: { executionStepId: input.executionStepId, toolCallId: t.toolCallId } },
          create: {
            organizationId: input.organizationId, executionRunId: input.executionRunId, executionStepId: input.executionStepId,
            agentDefinitionId, agentVersionId, toolCallId: t.toolCallId, alias: t.alias, actionKey: t.actionKey, riskLevel: t.riskLevel,
            decision: t.decision, status: t.status, authorizationId: t.authorizationId, approvalRequestId: t.approvalRequestId,
            inputHash: t.inputHash, outputHash: t.outputHash, durationMs: t.durationMs, retryCount: t.retryCount, completedAt: input.now,
          },
          update: { status: t.status, outputHash: t.outputHash },
        });
      }

      if (emitTerminal) {
        await this.incrementRollups(tx, input, { agentDefinitionId, agentVersionId, modelConfigurationId, providerKey, modelId }, status, usage, costSummary.estimatedCostMinor ?? 0, criticalSignalCount, rollupCurrency);
      }
      if (emitTerminal || firstRecord) {
        await this.audit.record(tx, { organizationId: input.organizationId, actorUserId: null, action: 'agent.result_recorded', resourceType: 'execution_step', resourceId: input.executionStepId, correlationId: input.correlationId, metadata: { status, evaluationStatus: evaluation.status, governanceStatus: governanceDecision.status, costWarning: costSummary.warningCode } });
        await this.recorder.recordEvidence(tx, { organizationId: input.organizationId, executionRunId: input.executionRunId, executionStepId: input.executionStepId, evidenceType: 'DECISION', content: { agentOperationalResult: { status, outputValidationStatus, evaluationStatus: evaluation.status, governanceStatus: governanceDecision.status, usage, cost: costSummary, checks: evaluation.checks, governance: governanceDecision } }, createdByType: 'WORKER', correlationId: input.correlationId });
        if (costSummary.warningCode) await this.recorder.recordEvent(tx, { organizationId: input.organizationId, executionRunId: input.executionRunId, executionStepId: input.executionStepId, eventType: 'agent.cost_rate_card_missing', actorType: 'WORKER', correlationId: input.correlationId, payload: { providerKey, modelId } });
        if (governanceDecision.status === 'LIMIT_EXCEEDED' || governanceDecision.status === 'BLOCKED') await this.recorder.recordEvent(tx, { organizationId: input.organizationId, executionRunId: input.executionRunId, executionStepId: input.executionStepId, eventType: 'agent.limit_exceeded', actorType: 'WORKER', correlationId: input.correlationId, payload: { status: governanceDecision.status, reasonCode: governanceDecision.reasonCode } });
        else if (governanceDecision.status === 'LIMIT_WARNING') await this.recorder.recordEvent(tx, { organizationId: input.organizationId, executionRunId: input.executionRunId, executionStepId: input.executionStepId, eventType: 'agent.limit_warning', actorType: 'WORKER', correlationId: input.correlationId, payload: { reasonCode: governanceDecision.reasonCode } });
      }
    });

    if (emitTerminal) {
      this.metrics.recordExecution({
        status, governanceStatus: governanceDecision.status, evaluationStatus: evaluation.status,
        providerKey, modelId, errorCode,
        modelCallCount: usage.modelCallCount, toolCallCount: usage.toolCallCount, inputTokens: usage.inputTokens, outputTokens: usage.outputTokens,
        estimatedCostMinor: costSummary.estimatedCostMinor, approvalCount: usage.approvalCount, securitySignalCount: usage.securitySignalCount,
        criticalSignalCount, unknownResult: status === 'UNKNOWN', limitExceeded: governanceDecision.status === 'LIMIT_EXCEEDED' || governanceDecision.status === 'BLOCKED',
        durationMs: usage.durationMs, executionRunId: input.executionRunId, executionStepId: input.executionStepId, agentVersionId, correlationId: input.correlationId,
      });
    }
  }

  /** Incrementa (upsert) os 8 buckets de rollup diário UTC — uma vez por execução terminal. */
  private async incrementRollups(
    tx: Prisma.TransactionClient, input: RecordResultInput,
    dims: { agentDefinitionId: string; agentVersionId: string; modelConfigurationId: string; providerKey: string; modelId: string },
    status: string, usage: { modelCallCount: number; toolCallCount: number; inputTokens: number; outputTokens: number; durationMs: number; approvalCount: number }, cost: number, criticalSignalCount: number, currency: string,
  ): Promise<void> {
    const periodDate = new Date(Date.UTC(input.now.getUTCFullYear(), input.now.getUTCMonth(), input.now.getUTCDate()));
    const dimId: Record<string, string> = {
      ORGANIZATION: input.organizationId, OPERATION: input.operationId, OPERATION_VERSION: input.operationVersionId,
      AGENT_DEFINITION: dims.agentDefinitionId, AGENT_VERSION: dims.agentVersionId, MODEL_CONFIGURATION: dims.modelConfigurationId,
      PROVIDER: dims.providerKey, MODEL: dims.modelId,
    };
    const inc = {
      executionCount: 1,
      succeededCount: status === 'SUCCEEDED' ? 1 : 0,
      failedCount: status === 'FAILED' ? 1 : 0,
      suspendedCount: status === 'SUSPENDED' || status === 'REQUIRES_APPROVAL' ? 1 : 0,
      unknownCount: status === 'UNKNOWN' ? 1 : 0,
      modelCallCount: usage.modelCallCount, toolCallCount: usage.toolCallCount,
      approvalCount: usage.approvalCount, criticalSignalCount,
    };
    for (const dimensionType of ROLLUP_DIMENSIONS) {
      const key = { organizationId: input.organizationId, dimensionType, dimensionId: dimId[dimensionType], periodDate, providerKey: dims.providerKey, modelId: dims.modelId, currency };
      await tx.agentUsageRollup.upsert({
        where: { uniq_rollup_bucket: key },
        create: { ...key, ...inc, inputTokens: BigInt(usage.inputTokens), outputTokens: BigInt(usage.outputTokens), estimatedCostMinor: BigInt(cost), durationMs: BigInt(usage.durationMs) },
        update: {
          executionCount: { increment: inc.executionCount }, succeededCount: { increment: inc.succeededCount }, failedCount: { increment: inc.failedCount },
          suspendedCount: { increment: inc.suspendedCount }, unknownCount: { increment: inc.unknownCount },
          modelCallCount: { increment: inc.modelCallCount }, toolCallCount: { increment: inc.toolCallCount },
          approvalCount: { increment: inc.approvalCount }, criticalSignalCount: { increment: inc.criticalSignalCount },
          inputTokens: { increment: BigInt(usage.inputTokens) }, outputTokens: { increment: BigInt(usage.outputTokens) },
          estimatedCostMinor: { increment: BigInt(cost) }, durationMs: { increment: BigInt(usage.durationMs) }, revision: { increment: 1 },
        },
      });
    }
  }
}
