/**
 * Arden.AS API — ponte StepExecutor → AgentRuntime (ARDEN-BE-007.3 §23).
 *
 * Adapta a interface determinística do motor (StepExecutor) para o runtime de agente.
 * Lê o SNAPSHOT seguro da etapa (`$agent`), recarrega o run (tenant da LINHA, nunca do
 * payload), chama o `AgentRuntime` (que faz toda a lógica), grava os eventos `agent.*` e
 * a auditoria de negócio, e traduz o resultado em SUCCEEDED (return) / demais (throw).
 * NÃO resolve provider nem duplica regras de runtime. Nunca vê segredo.
 */

import { Inject, Injectable } from '@nestjs/common';
import { AGENT_RUNTIME } from '@arden/contracts';
import { AuditRecorder } from '../audit/audit.recorder';
import { PrismaService } from '../database/prisma.service';
import { AgentOperationalResultRecorder } from '../agents/governance/agent-operational-result.recorder';
import { ExecutionsRepository } from './executions.repository';
import { ExecutionRecorder } from './execution.recorder';
import { StepExecutionError, StepSuspendedError, type StepExecutionContext, type StepExecutionResult } from './executors';
import type { AgentRuntime, AgentRuntimeOutcome } from '../agents/runtime/agent-runtime.types';

/** Snapshot mínimo e seguro guardado no input da etapa de agente. */
interface AgentStepSnapshot {
  agentKey: string;
  agentDefinitionId: string;
  agentVersionId: string;
  actionKey: string;
  source: unknown;
}

function readSnapshot(input: unknown): AgentStepSnapshot | null {
  if (!input || typeof input !== 'object') return null;
  const agent = (input as Record<string, unknown>).$agent;
  if (!agent || typeof agent !== 'object') return null;
  const a = agent as Record<string, unknown>;
  if (typeof a.agentKey !== 'string' || typeof a.agentDefinitionId !== 'string' || typeof a.agentVersionId !== 'string' || typeof a.actionKey !== 'string') {
    return null;
  }
  return {
    agentKey: a.agentKey,
    agentDefinitionId: a.agentDefinitionId,
    agentVersionId: a.agentVersionId,
    actionKey: a.actionKey,
    source: (input as Record<string, unknown>).$source ?? {},
  };
}

@Injectable()
export class AgentStepExecutor {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repo: ExecutionsRepository,
    @Inject(AGENT_RUNTIME) private readonly runtime: AgentRuntime,
    private readonly recorder: ExecutionRecorder,
    private readonly audit: AuditRecorder,
    private readonly results: AgentOperationalResultRecorder,
  ) {}

  async execute(ctx: StepExecutionContext): Promise<StepExecutionResult> {
    const snapshot = readSnapshot(ctx.input);
    if (!snapshot) throw new StepExecutionError('AGENT_INPUT_INVALID', 'Etapa de agente sem snapshot válido.', false);

    // Tenant e coordenadas vêm da LINHA do run, nunca de payload não confiável.
    const run = await this.repo.findRunById(ctx.executionRunId);
    if (!run || run.organizationId !== ctx.organizationId) {
      throw new StepExecutionError('EXECUTION_NOT_ALLOWED', 'Execução não encontrada para o tenant.', false);
    }

    const outcome = await this.runtime.execute({
      organizationId: run.organizationId,
      operationId: run.operationId,
      operationVersionId: run.operationVersionId,
      executionRunId: ctx.executionRunId,
      executionStepId: ctx.executionStepId,
      agentDefinitionId: snapshot.agentDefinitionId,
      agentVersionId: snapshot.agentVersionId,
      input: snapshot.source,
      correlationId: run.correlationId,
      attemptNumber: ctx.attemptNumber,
      requestedByUserId: run.requestedByUserId,
      timeoutMs: 0,
    });

    await this.persistTrail(run.organizationId, run.correlationId, ctx.executionRunId, ctx.executionStepId, outcome);

    // §5/§8: resultado operacional consolidado (usage/custo/avaliação/governança), idempotente.
    await this.results.record({
      organizationId: run.organizationId, executionRunId: ctx.executionRunId, executionStepId: ctx.executionStepId,
      operationId: run.operationId, operationVersionId: run.operationVersionId, correlationId: run.correlationId,
      startedAt: ctx.now, now: ctx.now, outcome,
    });

    if (outcome.result.status === 'SUCCEEDED') {
      return {
        output: outcome.result.output ?? null,
        effectApplied: outcome.result.toolCallCount > 0, // tool calling pode ter aplicado efeito externo
        evidence: [{ evidenceType: 'OUTPUT', content: outcome.evidence }],
      };
    }

    // REQUIRES_APPROVAL → SUSPENSÃO cooperativa (não é falha): pausa a etapa/execução.
    if (outcome.result.status === 'REQUIRES_APPROVAL') {
      throw new StepSuspendedError('AGENT_TOOL_REQUIRES_APPROVAL', outcome.result.errorSummary ?? 'Tool call requer aprovação humana.', outcome.evidence);
    }

    // FAILED/UNKNOWN/SUSPENDED → erro tipado com evidência sanitizada para o processor.
    const code = outcome.result.errorCode ?? 'AGENT_OUTPUT_INVALID';
    const summary = outcome.result.errorSummary ?? 'Falha na execução do agente.';
    throw new AgentStepError(code, summary, outcome.retryable, outcome.evidence);
  }

  /** Grava eventos agent.* (execução) + auditoria de negócio numa transação própria. */
  private async persistTrail(
    organizationId: string,
    correlationId: string,
    executionRunId: string,
    executionStepId: string,
    outcome: AgentRuntimeOutcome,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      for (const ev of outcome.events) {
        await this.recorder.recordEvent(tx, {
          organizationId, executionRunId, executionStepId,
          eventType: ev.eventType, actorType: 'WORKER', correlationId, payload: ev.payload,
        });
      }
      for (const entry of outcome.audit) {
        await this.audit.record(tx, {
          organizationId, actorUserId: null, action: entry.action,
          resourceType: 'execution_step', resourceId: executionStepId,
          outcome: entry.outcome, correlationId, metadata: entry.metadata,
        });
      }
    });
  }
}

/** Erro de etapa de agente que carrega a evidência sanitizada para o processor. */
export class AgentStepError extends StepExecutionError {
  constructor(code: string, message: string, retryable: boolean, readonly toolEvidence: Record<string, unknown>) {
    super(code, message, retryable);
    this.name = 'AgentStepError';
  }
}
