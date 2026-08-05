/**
 * Arden.AS API — processamento de execução no worker (ARDEN-BE-005 §17–§25).
 *
 * Processa UM job (uma execução) por aquisição: transiciona QUEUED→RUNNING,
 * processa etapas determinísticas em ordem, respeita pause/cancel/timeout em
 * checkpoints, agenda retries com backoff, e compensa em ordem inversa quando uma
 * execução falha após efeitos. Idempotente: executores internos são determinísticos
 * (mesma etapa → mesmo efeito), então um retry não duplica efeito.
 */

import { Injectable } from '@nestjs/common';
import type { Prisma, ExecutionRun as DbRun, ExecutionStep as DbStep } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { ExecutionsRepository } from './executions.repository';
import { ExecutionRecorder } from './execution.recorder';
import { ExecutionQueue, type AcquiredJob } from './execution.queue';
import { StepExecutionError, StepSuspendedError, type StepExecutionContext } from './executors';
import { StepExecutorRegistry } from './step-executor-registry';
import { canTransition, isTerminal } from './execution.state-machine';
import { backoffDelayMs, DEFAULT_RETRY } from './retry-policy';

@Injectable()
export class ExecutionProcessor {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repo: ExecutionsRepository,
    private readonly recorder: ExecutionRecorder,
    private readonly queue: ExecutionQueue,
    private readonly registry: StepExecutorRegistry,
  ) {}

  /** Processa um job adquirido. Retorna quando o job é liberado/concluído. */
  async process(job: AcquiredJob, workerId: string, leaseSeconds: number): Promise<void> {
    let run = await this.repo.findRunById(job.executionRunId);
    if (!run) {
      await this.prisma.$transaction((tx) => this.queue.complete(tx, job.id));
      return;
    }
    const corr = run.correlationId;

    await this.recorder.recordEventStandalone(run.organizationId, run.id, 'execution_job.acquired', 'WORKER', corr, { jobId: job.id, workerId });

    // Estado de entrada.
    if (run.status === 'QUEUED') {
      run = await this.transition(run, 'RUNNING', 'WORKER', corr, { startedAt: run.startedAt ?? new Date() });
    } else if (run.status === 'PAUSE_REQUESTED') {
      await this.finishPause(run, corr, job.id);
      return;
    } else if (run.status === 'CANCEL_REQUESTED') {
      await this.finishCancel(run, corr);
      return;
    } else if (run.status !== 'RUNNING') {
      await this.prisma.$transaction((tx) => this.queue.complete(tx, job.id));
      return;
    }

    // Loop de etapas com checkpoints.
    for (;;) {
      run = (await this.repo.findRunById(run.id))!;
      if (run.timeoutAt && run.timeoutAt < new Date()) {
        await this.finishTimeout(run, corr, job.id);
        return;
      }
      if (run.status === 'PAUSE_REQUESTED') {
        await this.finishPause(run, corr, job.id);
        return;
      }
      if (run.status === 'CANCEL_REQUESTED') {
        await this.finishCancel(run, corr);
        return;
      }

      // Retomada de suspensão (ARDEN-BE-007.5): etapas PAUSED voltam a PENDING para
      // reprocessar (o loop do agente refaz o caminho determinístico com a autorização já ativa).
      await this.prisma.executionStep.updateMany({ where: { executionRunId: run.id, status: 'PAUSED' }, data: { status: 'PENDING', revision: { increment: 1 } } });

      const steps = await this.repo.stepsForRun(run.id);
      const next = steps.find((s) => s.status === 'PENDING' || s.status === 'READY' || (s.status === 'RETRY_WAIT' && (!s.nextAttemptAt || s.nextAttemptAt <= new Date())));

      if (!next) {
        const anyFailed = steps.some((s) => s.status === 'FAILED' || s.status === 'TIMED_OUT');
        if (anyFailed) {
          await this.failAndCompensate(run, corr, job.id);
          return;
        }
        // Etapas ainda aguardando retry (nextAttemptAt futuro) → reagenda o job.
        const waiting = steps.filter((s) => s.status === 'RETRY_WAIT' && s.nextAttemptAt).map((s) => s.nextAttemptAt!.getTime());
        const pending = steps.some((s) => ['PENDING', 'READY', 'RUNNING', 'RETRY_WAIT', 'PAUSED'].includes(s.status));
        if (pending) {
          const availableAt = waiting.length ? new Date(Math.min(...waiting)) : new Date(Date.now() + 1000);
          await this.prisma.$transaction((tx) => this.queue.release(tx, job.id, { retry: true, availableAt, lastError: 'step_retry_wait' }));
          return;
        }
        await this.transition(run, 'SUCCEEDED', 'WORKER', corr, { completedAt: new Date(), currentStepId: null });
        await this.prisma.$transaction((tx) => this.queue.complete(tx, job.id));
        return;
      }

      await this.queue.heartbeat(job.id, workerId, leaseSeconds);
      const outcome = await this.processStep(run, next, workerId, corr);
      if (outcome === 'FAILED') {
        run = (await this.repo.findRunById(run.id))!;
        await this.failAndCompensate(run, corr, job.id);
        return;
      }
      if (outcome === 'SUSPENDED') {
        // Suspensão cooperativa (aprovação de tool): pausa a execução e libera o job.
        run = (await this.repo.findRunById(run.id))!;
        run = await this.transition(run, 'PAUSE_REQUESTED', 'WORKER', corr);
        await this.transition(run, 'PAUSED', 'WORKER', corr, { pausedAt: new Date() });
        await this.prisma.$transaction((tx) => this.queue.complete(tx, job.id));
        return;
      }
      // SUCCEEDED ou RETRY_SCHEDULED → continua o loop; o desfecho é reavaliado no
      // topo (RETRY_SCHEDULED cai no ramo de reagendamento acima).
    }
  }

  /** Processa UMA etapa numa transação. Retorna o desfecho. */
  private async processStep(run: DbRun, step: DbStep, workerId: string, corr: string): Promise<'SUCCEEDED' | 'RETRY_SCHEDULED' | 'FAILED' | 'SUSPENDED'> {
    const attemptNumber = step.attemptCount + 1;
    const now = new Date();

    // Marca a etapa RUNNING + abre tentativa (idempotente por unique).
    await this.prisma.$transaction(async (tx) => {
      await tx.executionStep.updateMany({ where: { id: step.id }, data: { status: 'RUNNING', startedAt: step.startedAt ?? now, attemptCount: attemptNumber, revision: { increment: 1 } } });
      await tx.executionRun.updateMany({ where: { id: run.id }, data: { currentStepId: step.id, updatedAt: now } });
      await tx.executionAttempt.create({ data: { organizationId: run.organizationId, executionRunId: run.id, executionStepId: step.id, attemptNumber, workerId, status: 'STARTED' } });
      await this.recorder.recordEvent(tx, { organizationId: run.organizationId, executionRunId: run.id, executionStepId: step.id, eventType: 'execution_step.started', actorType: 'WORKER', correlationId: corr, payload: { attempt: attemptNumber, actionKey: step.actionKey } });
    });

    const context: StepExecutionContext = {
      organizationId: run.organizationId, executionRunId: run.id, executionStepId: step.id,
      attemptNumber, input: step.input, definitionStepKey: step.definitionStepKey, now,
    };

    try {
      const executor = this.registry.resolve(step.actionKey);
      const result = await executor.execute(context);
      await this.prisma.$transaction(async (tx) => {
        await tx.executionStep.updateMany({ where: { id: step.id }, data: { status: 'SUCCEEDED', output: (result.output ?? null) as Prisma.InputJsonValue, completedAt: new Date(), errorCode: null, errorSummary: null, revision: { increment: 1 } } });
        await tx.executionAttempt.updateMany({ where: { executionStepId: step.id, attemptNumber }, data: { status: 'SUCCEEDED', completedAt: new Date() } });
        for (const ev of result.evidence) {
          await this.recorder.recordEvidence(tx, { organizationId: run.organizationId, executionRunId: run.id, executionStepId: step.id, evidenceType: ev.evidenceType, content: ev.content, createdByType: 'WORKER', correlationId: corr });
        }
        await this.recorder.recordEvent(tx, { organizationId: run.organizationId, executionRunId: run.id, executionStepId: step.id, eventType: 'execution_step.succeeded', actorType: 'WORKER', correlationId: corr, payload: { attempt: attemptNumber } });
      });
      return 'SUCCEEDED';
    } catch (err) {
      // Suspensão cooperativa (aprovação de tool) — NÃO é falha: pausa a etapa.
      if (err instanceof StepSuspendedError) {
        await this.prisma.$transaction(async (tx) => {
          await tx.executionStep.updateMany({ where: { id: step.id }, data: { status: 'PAUSED', revision: { increment: 1 } } });
          await this.recorder.recordEvidence(tx, { organizationId: run.organizationId, executionRunId: run.id, executionStepId: step.id, evidenceType: 'DECISION', content: { ...err.evidence, suspended: true, code: err.code }, createdByType: 'WORKER', correlationId: corr });
          await this.recorder.recordEvent(tx, { organizationId: run.organizationId, executionRunId: run.id, executionStepId: step.id, eventType: 'execution_step.suspended', actorType: 'WORKER', correlationId: corr, payload: { attempt: attemptNumber, code: err.code } });
        });
        return 'SUSPENDED';
      }
      const code = err instanceof StepExecutionError ? err.code : 'STEP_FAILED';
      const retryable = err instanceof StepExecutionError ? err.retryable : false;
      const summary = err instanceof Error ? err.message : 'Erro de execução da etapa.';
      const willRetry = retryable && attemptNumber < step.maxAttempts;
      await this.prisma.$transaction(async (tx) => {
        await tx.executionAttempt.updateMany({ where: { executionStepId: step.id, attemptNumber }, data: { status: 'FAILED', completedAt: new Date(), errorCode: code, errorSummary: summary } });
        if (willRetry) {
          const delay = backoffDelayMs(DEFAULT_RETRY, attemptNumber + 1);
          await tx.executionStep.updateMany({ where: { id: step.id }, data: { status: 'RETRY_WAIT', nextAttemptAt: new Date(Date.now() + delay), errorCode: code, errorSummary: summary, revision: { increment: 1 } } });
          await this.recorder.recordEvent(tx, { organizationId: run.organizationId, executionRunId: run.id, executionStepId: step.id, eventType: 'execution_step.retry_scheduled', actorType: 'WORKER', correlationId: corr, payload: { attempt: attemptNumber, code } });
        } else {
          await tx.executionStep.updateMany({ where: { id: step.id }, data: { status: 'FAILED', errorCode: code, errorSummary: summary, completedAt: new Date(), revision: { increment: 1 } } });
          // Evidência de ferramenta externa (sanitizada) quando disponível; senão, o erro base.
          const toolEvidence = (err as { toolEvidence?: Record<string, unknown> }).toolEvidence;
          const content = toolEvidence ? { ...toolEvidence, code, summary, attempt: attemptNumber } : { code, summary, attempt: attemptNumber };
          await this.recorder.recordEvidence(tx, { organizationId: run.organizationId, executionRunId: run.id, executionStepId: step.id, evidenceType: 'ERROR', content, createdByType: 'WORKER', correlationId: corr });
          await this.recorder.recordEvent(tx, { organizationId: run.organizationId, executionRunId: run.id, executionStepId: step.id, eventType: 'execution_step.failed', actorType: 'WORKER', correlationId: corr, payload: { attempt: attemptNumber, code } });
        }
      });
      return willRetry ? 'RETRY_SCHEDULED' : 'FAILED';
    }
  }

  /** Falha da execução + compensação em ordem inversa das etapas com efeito. */
  private async failAndCompensate(run: DbRun, corr: string, jobId: string): Promise<void> {
    const failedStep = (await this.repo.stepsForRun(run.id)).find((s) => s.status === 'FAILED' || s.status === 'TIMED_OUT');
    await this.transition(run, 'FAILED', 'WORKER', corr, { completedAt: new Date(), errorCode: failedStep?.errorCode ?? 'STEP_FAILED', errorSummary: failedStep?.errorSummary ?? null });
    await this.compensate(run, corr, jobId);
  }

  /** Compensa (a partir de FAILED ou TIMED_OUT) em ordem inversa das etapas com efeito. */
  private async compensate(run: DbRun, corr: string, jobId: string): Promise<void> {
    const current = (await this.repo.findRunById(run.id))!;
    await this.transition(current, 'COMPENSATING', 'WORKER', corr);

    const succeeded = (await this.repo.stepsForRun(run.id)).filter((s) => s.status === 'SUCCEEDED').sort((a, b) => b.sequence - a.sequence);
    let compensationFailed = false;
    for (const step of succeeded) {
      const executor = this.registry.resolve(step.actionKey);
      if (!executor.compensate) continue;
      try {
        await this.prisma.$transaction(async (tx) => {
          await tx.executionStep.updateMany({ where: { id: step.id }, data: { status: 'COMPENSATING', revision: { increment: 1 } } });
          await this.recorder.recordEvent(tx, { organizationId: run.organizationId, executionRunId: run.id, executionStepId: step.id, eventType: 'execution_step.compensation_started', actorType: 'WORKER', correlationId: corr, payload: {} });
        });
        const result = await executor.compensate({ organizationId: run.organizationId, executionRunId: run.id, executionStepId: step.id, attemptNumber: step.attemptCount, input: step.input, definitionStepKey: step.definitionStepKey, now: new Date() });
        await this.prisma.$transaction(async (tx) => {
          await tx.executionStep.updateMany({ where: { id: step.id }, data: { status: 'COMPENSATED', revision: { increment: 1 } } });
          await this.recorder.recordEvidence(tx, { organizationId: run.organizationId, executionRunId: run.id, executionStepId: step.id, evidenceType: 'COMPENSATION', content: { output: result.output }, createdByType: 'WORKER', correlationId: corr });
          await this.recorder.recordEvent(tx, { organizationId: run.organizationId, executionRunId: run.id, executionStepId: step.id, eventType: 'execution_step.compensated', actorType: 'WORKER', correlationId: corr, payload: {} });
        });
      } catch (err) {
        compensationFailed = true;
        await this.prisma.$transaction(async (tx) => {
          await tx.executionStep.updateMany({ where: { id: step.id }, data: { status: 'COMPENSATION_FAILED', revision: { increment: 1 } } });
          await this.recorder.recordEvent(tx, { organizationId: run.organizationId, executionRunId: run.id, executionStepId: step.id, eventType: 'execution_step.compensation_failed', actorType: 'WORKER', correlationId: corr, payload: { error: err instanceof Error ? err.message : 'erro' } });
        });
      }
    }

    const compensating = (await this.repo.findRunById(run.id))!;
    await this.transition(compensating, compensationFailed ? 'COMPENSATION_FAILED' : 'COMPENSATED', 'WORKER', corr, { completedAt: new Date() });
    await this.prisma.$transaction((tx) => this.queue.complete(tx, jobId));
  }

  private async finishPause(run: DbRun, corr: string, jobId: string): Promise<void> {
    await this.transition(run, 'PAUSED', 'WORKER', corr, { pausedAt: new Date() });
    await this.prisma.$transaction((tx) => this.queue.complete(tx, jobId));
  }

  private async finishCancel(run: DbRun, corr: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.executionStep.updateMany({ where: { executionRunId: run.id, status: { in: ['PENDING', 'READY', 'RETRY_WAIT'] } }, data: { status: 'CANCELLED', revision: { increment: 1 } } });
    });
    await this.transition(run, 'CANCELLED', 'WORKER', corr, { cancelledAt: new Date(), completedAt: new Date() });
    // Cancela os jobs da execução (inclui o job corrente adquirido).
    await this.prisma.$transaction((tx) => this.queue.cancel(tx, run.id));
  }

  private async finishTimeout(run: DbRun, corr: string, jobId: string): Promise<void> {
    await this.transition(run, 'TIMED_OUT', 'WORKER', corr, { completedAt: new Date(), errorCode: 'EXECUTION_TIMED_OUT' });
    await this.prisma.$transaction(async (tx) => {
      await this.recorder.recordEvidence(tx, { organizationId: run.organizationId, executionRunId: run.id, evidenceType: 'ERROR', content: { code: 'EXECUTION_TIMED_OUT' }, createdByType: 'WORKER', correlationId: corr });
    });
    const timedOut = (await this.repo.findRunById(run.id))!;
    await this.compensate(timedOut, corr, jobId);
  }

  /** Transição guardada do run com evento; retorna a linha atualizada. */
  private async transition(run: DbRun, target: DbRun['status'], actorType: 'WORKER' | 'SYSTEM', corr: string, extra: Prisma.ExecutionRunUncheckedUpdateInput = {}): Promise<DbRun> {
    if (isTerminal(run.status) || !canTransition(run.status, target)) return run;
    return this.prisma.$transaction(async (tx) => {
      await tx.executionRun.updateMany({ where: { id: run.id, status: run.status }, data: { status: target, revision: { increment: 1 }, ...extra } });
      await this.recorder.recordEvent(tx, { organizationId: run.organizationId, executionRunId: run.id, eventType: `execution.${target.toLowerCase()}`, actorType, correlationId: corr, payload: { from: run.status, to: target } });
      return (await tx.executionRun.findUnique({ where: { id: run.id } }))!;
    });
  }
}
