/**
 * Arden.AS API — ponte StepExecutor → ExternalToolExecutor (ARDEN-BE-006.6).
 *
 * Adapta a interface determinística do motor (StepExecutor) para a execução de
 * ferramenta externa de conector. Lê o alias/actionKey do SNAPSHOT da etapa (`$tool`),
 * recarrega o run (tenant da LINHA, nunca do payload) e os outputs de etapas
 * anteriores, deriva a idempotency-key ESTÁVEL por etapa (retries reusam a mesma
 * chave), executa e traduz o resultado em SUCCEEDED / FAILED / UNKNOWN — registrando
 * evidência e auditoria SANITIZADAS. Nunca vê segredo.
 */

import { Injectable } from '@nestjs/common';
import { AuditRecorder } from '../audit/audit.recorder';
import { ExternalToolExecutor } from '../connectors/tools/external-tool-executor';
import type { ExternalToolExecutionResult } from '../connectors/tools/tool-execution.types';
import { PrismaService } from '../database/prisma.service';
import { ExecutionsRepository } from './executions.repository';
import { StepExecutionError, type StepExecutionContext, type StepExecutionResult } from './executors';

/** Snapshot mínimo e seguro guardado no input da etapa externa. */
interface ToolStepSnapshot {
  alias: string;
  actionKey: string;
  source: unknown;
}

function readSnapshot(input: unknown): ToolStepSnapshot | null {
  if (!input || typeof input !== 'object') return null;
  const tool = (input as Record<string, unknown>).$tool;
  if (!tool || typeof tool !== 'object') return null;
  const t = tool as Record<string, unknown>;
  if (typeof t.alias !== 'string' || typeof t.actionKey !== 'string') return null;
  return { alias: t.alias, actionKey: t.actionKey, source: (input as Record<string, unknown>).$source ?? {} };
}

const AUDIT_EVENT: Record<ExternalToolExecutionResult['status'], string> = {
  SUCCEEDED: 'external_tool.execution_succeeded',
  FAILED: 'external_tool.execution_failed',
  UNKNOWN: 'external_tool.execution_unknown',
};

@Injectable()
export class ExternalToolStepExecutor {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repo: ExecutionsRepository,
    private readonly executor: ExternalToolExecutor,
    private readonly audit: AuditRecorder,
  ) {}

  async execute(ctx: StepExecutionContext): Promise<StepExecutionResult> {
    const snapshot = readSnapshot(ctx.input);
    if (!snapshot) throw new StepExecutionError('TOOL_INPUT_INVALID', 'Etapa externa sem snapshot de ferramenta.', false);

    // Tenant e coordenadas vêm da LINHA do run, nunca de payload não confiável.
    const run = await this.repo.findRunById(ctx.executionRunId);
    if (!run || run.organizationId !== ctx.organizationId) {
      throw new StepExecutionError('EXECUTION_NOT_ALLOWED', 'Execução não encontrada para o tenant.', false);
    }
    const priorOutputs = await this.collectPriorOutputs(ctx);

    // Idempotency-key ESTÁVEL por etapa (retries reutilizam) — provider dedup.
    const idempotencyKey = `arden:${ctx.executionRunId}:${ctx.executionStepId}`;

    await this.recordStarted(run.organizationId, run.correlationId, snapshot, ctx);

    const result = await this.executor.execute({
      organizationId: run.organizationId,
      operationId: run.operationId,
      operationVersionId: run.operationVersionId,
      executionRunId: ctx.executionRunId,
      executionStepId: ctx.executionStepId,
      alias: snapshot.alias,
      actionKey: snapshot.actionKey,
      input: snapshot.source,
      priorStepOutputs: priorOutputs,
      correlationId: run.correlationId,
      idempotencyKey,
      attemptNumber: ctx.attemptNumber,
      timeoutMs: 0,
      nodeEnv: process.env.NODE_ENV ?? 'development',
      actorUserId: run.requestedByUserId,
    });

    await this.recordFinished(run.organizationId, run.correlationId, result);

    if (result.status === 'SUCCEEDED') {
      return {
        output: result.output ?? null,
        effectApplied: snapshot.actionKey.startsWith('external.'),
        evidence: [{ evidenceType: 'OUTPUT', content: result.evidence }],
      };
    }

    // FAILED/UNKNOWN → erro tipado. UNKNOWN nunca é retry automático (retryable=false).
    const code = result.errorCode ?? (result.status === 'UNKNOWN' ? 'EXTERNAL_RESULT_UNKNOWN' : 'EXTERNAL_PROVIDER_ERROR');
    const summary = result.errorSummary ?? (result.status === 'UNKNOWN' ? 'Resultado externo incerto.' : 'Falha na ferramenta externa.');
    throw new ExternalStepError(code, summary, result.retryable, result.evidence);
  }

  private async collectPriorOutputs(ctx: StepExecutionContext): Promise<Record<string, unknown>> {
    const steps = await this.repo.stepsForRun(ctx.executionRunId);
    const out: Record<string, unknown> = {};
    for (const s of steps) {
      if (s.id === ctx.executionStepId) continue;
      if (s.status === 'SUCCEEDED' && s.output !== null && s.output !== undefined) {
        out[s.definitionStepKey] = s.output;
      }
    }
    return out;
  }

  private async recordStarted(organizationId: string, correlationId: string, snapshot: ToolStepSnapshot, ctx: StepExecutionContext): Promise<void> {
    await this.prisma.$transaction((tx) =>
      this.audit.record(tx, {
        organizationId, actorUserId: null, action: 'external_tool.execution_started',
        resourceType: 'execution_step', resourceId: ctx.executionStepId, correlationId,
        metadata: { alias: snapshot.alias, actionKey: snapshot.actionKey, attempt: ctx.attemptNumber },
      }),
    );
  }

  private async recordFinished(organizationId: string, correlationId: string, result: ExternalToolExecutionResult): Promise<void> {
    await this.prisma.$transaction((tx) =>
      this.audit.record(tx, {
        organizationId, actorUserId: null, action: AUDIT_EVENT[result.status],
        resourceType: 'execution_step', resourceId: result.connectionId || 'external_tool',
        outcome: result.status === 'SUCCEEDED' ? 'SUCCESS' : 'FAILURE', correlationId,
        metadata: result.evidence,
      }),
    );
  }
}

/** Erro de etapa externa que carrega a evidência sanitizada para o processor. */
export class ExternalStepError extends StepExecutionError {
  constructor(code: string, message: string, retryable: boolean, readonly toolEvidence: Record<string, unknown>) {
    super(code, message, retryable);
    this.name = 'ExternalStepError';
  }
}
