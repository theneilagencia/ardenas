/**
 * Arden.AS API — serviço de execução (ARDEN-BE-005).
 *
 * Cria execuções de forma TRANSACIONAL: valida operação/versão publicada,
 * reavalia autoridade (BE-004), consome autorização de uso único quando exigida,
 * materializa etapas (snapshot), grava eventos/evidência inicial e enfileira o job
 * — tudo em uma transação. Comandos (pause/resume/cancel/retry) são cooperativos e
 * persistidos, com transições guardadas pela máquina de estados.
 */

import { Injectable } from '@nestjs/common';
import type { Prisma, ExecutionRun as DbRun } from '@prisma/client';
import {
  operationDefinition,
  type CreateExecutionRequest,
  type ExecutionCommandRequest,
  type ListExecutionsQuery,
  type ListExecutionEventsQuery,
  type ExecutionRun,
  type ExecutionStep,
  type ExecutionEvent,
  type EvidenceRecord,
  type PaginationMeta,
  type ActionKey,
  type ExecutorActionKey,
} from '@arden/contracts';
import { PrismaService } from '../database/prisma.service';
import { IdempotencyService } from '../modules/idempotency/idempotency.service';
import type { AuthenticatedRequestContext } from '../identity/request-context';
import { runIdempotentCommand } from '../operations/command.helpers';
import {
  notFound, executionNotAllowed, actionDenied, authorizationRequired, authorizationAlreadyUsed,
  authorizationExpired, authorizationInvalidated, authorizationPayloadMismatch,
  executionNotPausable, executionNotResumable, executionNotCancellable, executionNotRetryable,
} from '../common/errors/api-error';
import { assertRevision } from '../common/concurrency/optimistic-concurrency';
import { EnforcementService } from '../enforcement/enforcement.service';
import { hashActionPayload } from '../enforcement/action-payload';
import { ExecutionsRepository } from './executions.repository';
import { ExecutionRecorder } from './execution.recorder';
import { ExecutionQueue } from './execution.queue';
import { hasExecutor } from './executors';
import { canTransition } from './execution.state-machine';
import { toRunContract, toStepContract, toEventContract, toEvidenceContract } from './execution.serializers';

@Injectable()
export class ExecutionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repo: ExecutionsRepository,
    private readonly idem: IdempotencyService,
    private readonly enforcement: EnforcementService,
    private readonly recorder: ExecutionRecorder,
    private readonly queue: ExecutionQueue,
  ) {}

  private orgId(ctx: AuthenticatedRequestContext): string {
    return ctx.organizationId as string;
  }

  // ── Leitura ─────────────────────────────────────────────────────────────────
  async list(ctx: AuthenticatedRequestContext, query: ListExecutionsQuery): Promise<{ data: ExecutionRun[]; pagination: PaginationMeta }> {
    const rows = await this.repo.listRuns(this.orgId(ctx), { status: query.status, operationId: query.operationId }, query.limit + 1, query.cursor);
    const hasNextPage = rows.length > query.limit;
    const page = hasNextPage ? rows.slice(0, query.limit) : rows;
    const last = page[page.length - 1];
    return {
      data: page.map(toRunContract),
      pagination: { cursor: query.cursor ?? null, nextCursor: hasNextPage && last ? last.createdAt.toISOString() : null, hasNextPage, limit: query.limit },
    };
  }

  private async loadRun(ctx: AuthenticatedRequestContext, id: string): Promise<DbRun> {
    const run = await this.repo.findRun(this.orgId(ctx), id);
    if (!run) throw notFound('Execução não encontrada.');
    return run;
  }

  async get(ctx: AuthenticatedRequestContext, id: string): Promise<{ data: ExecutionRun }> {
    return { data: toRunContract(await this.loadRun(ctx, id)) };
  }

  async listSteps(ctx: AuthenticatedRequestContext, runId: string): Promise<{ data: ExecutionStep[]; pagination: PaginationMeta }> {
    await this.loadRun(ctx, runId);
    const rows = await this.repo.listSteps(this.orgId(ctx), runId);
    return { data: rows.map(toStepContract), pagination: { cursor: null, nextCursor: null, hasNextPage: false, limit: rows.length || 1 } };
  }

  async getStep(ctx: AuthenticatedRequestContext, runId: string, stepId: string): Promise<{ data: ExecutionStep }> {
    const step = await this.repo.findStep(this.orgId(ctx), runId, stepId);
    if (!step) throw notFound('Etapa não encontrada.');
    return { data: toStepContract(step) };
  }

  async listEvents(ctx: AuthenticatedRequestContext, runId: string, query: ListExecutionEventsQuery): Promise<{ data: ExecutionEvent[]; pagination: PaginationMeta }> {
    await this.loadRun(ctx, runId);
    const rows = await this.repo.listEvents(this.orgId(ctx), runId, query.limit + 1, query.cursor);
    const hasNextPage = rows.length > query.limit;
    const page = hasNextPage ? rows.slice(0, query.limit) : rows;
    const last = page[page.length - 1];
    return {
      data: page.map(toEventContract),
      pagination: { cursor: query.cursor ?? null, nextCursor: hasNextPage && last ? String(last.sequence) : null, hasNextPage, limit: query.limit },
    };
  }

  async listEvidence(ctx: AuthenticatedRequestContext, runId: string): Promise<{ data: EvidenceRecord[]; pagination: PaginationMeta }> {
    await this.loadRun(ctx, runId);
    const rows = await this.repo.listEvidence(this.orgId(ctx), runId);
    return { data: rows.map(toEvidenceContract), pagination: { cursor: null, nextCursor: null, hasNextPage: false, limit: rows.length || 1 } };
  }

  async getEvidence(ctx: AuthenticatedRequestContext, runId: string, evidenceId: string): Promise<{ data: EvidenceRecord }> {
    const ev = await this.repo.findEvidence(this.orgId(ctx), runId, evidenceId);
    if (!ev) throw notFound('Evidência não encontrada.');
    return { data: toEvidenceContract(ev) };
  }

  // ── Criação ───────────────────────────────────────────────────────────────────
  async create(
    ctx: AuthenticatedRequestContext,
    operationId: string,
    body: CreateExecutionRequest,
    key: string,
  ): Promise<{ statusCode: number; body: { data: ExecutionRun } }> {
    const orgId = this.orgId(ctx);
    const now = new Date();
    const inputHash = hashActionPayload(body.actionKey as ActionKey, body.input);

    const result = await runIdempotentCommand<{ data: ExecutionRun }>(
      { idem: this.idem, prisma: this.prisma },
      { method: 'POST', path: `/organizations/${orgId}/operations/${operationId}/executions`, idempotencyKey: key, userId: ctx.userId, organizationId: orgId },
      body, 201,
      async (tx) => {
        const op = await tx.operation.findFirst({ where: { id: operationId, organizationId: orgId } });
        if (!op) throw notFound('Operação não encontrada.');
        if (op.status !== 'active') throw executionNotAllowed('Operação não está ativa.');
        if (!op.publishedVersionId) throw executionNotAllowed('Operação sem versão publicada.');
        if (body.operationVersionId && body.operationVersionId !== op.publishedVersionId) {
          throw executionNotAllowed('Só a versão publicada corrente pode executar.');
        }
        const version = await tx.operationVersion.findFirst({ where: { id: op.publishedVersionId, organizationId: orgId, status: 'published' } });
        if (!version) throw executionNotAllowed('Versão publicada não encontrada.');
        const definition = operationDefinition.parse(version.definition);

        // Enforcement de autoridade (BE-004).
        const evaluation = await this.enforcement.evaluateCore(ctx, operationId, body.actionKey as ActionKey, body.input, now, tx);
        if (evaluation.decision === 'DENIED') throw actionDenied('Ação bloqueada pela avaliação de autoridade.', { reasonCodes: evaluation.reasonCodes });

        // Autorização: exigida em APPROVAL_REQUIRED; consumida se fornecida.
        let consumedAuthId: string | null = null;
        if (evaluation.decision === 'APPROVAL_REQUIRED' && !body.actionAuthorizationId) {
          throw authorizationRequired();
        }
        if (body.actionAuthorizationId) {
          consumedAuthId = await this.validateAndConsumeAuthorization(tx, orgId, body.actionAuthorizationId, {
            actionKey: body.actionKey, operationId, operationVersionId: op.publishedVersionId, inputHash, now,
          });
        }

        const maxAttempts = body.maxAttempts ?? 1;
        const timeoutAt = body.timeoutSeconds ? new Date(now.getTime() + body.timeoutSeconds * 1000) : null;

        const run = await tx.executionRun.create({
          data: {
            organizationId: orgId, operationId, operationVersionId: op.publishedVersionId,
            requestedByUserId: ctx.userId, actionAuthorizationId: consumedAuthId, actionKey: body.actionKey,
            triggerType: 'MANUAL', status: 'PENDING', input: (body.input ?? {}) as Prisma.InputJsonValue, inputHash,
            maxAttempts, timeoutAt, correlationId: ctx.correlationId,
          },
        });

        // Materializa etapas (snapshot da definição publicada).
        const steps = [...definition.steps].sort((a, b) => a.order - b.order);
        for (let i = 0; i < steps.length; i++) {
          const s = steps[i];
          const executor = this.resolveExecutor(body.stepExecutors, s.id, s.producesEvidence);
          const stepInput = (body.input ?? {}) as Prisma.InputJsonValue;
          await tx.executionStep.create({
            data: {
              organizationId: orgId, executionRunId: run.id, definitionStepKey: s.id, sequence: i + 1,
              name: s.name, actionKey: executor, status: 'PENDING',
              input: stepInput, inputHash: hashActionPayload(executor, body.input),
              maxAttempts, timeoutAt,
            },
          });
        }

        // Eventos + evidência inicial.
        await this.recorder.recordEvent(tx, { organizationId: orgId, executionRunId: run.id, eventType: 'execution.created', actorType: 'USER', actorId: ctx.userId, correlationId: ctx.correlationId, payload: { operationId, actionKey: body.actionKey } });
        await this.recorder.recordEvidence(tx, { organizationId: orgId, executionRunId: run.id, evidenceType: 'INPUT', content: { input: body.input ?? null, inputHash }, createdByType: 'USER', createdById: ctx.userId, correlationId: ctx.correlationId });
        if (consumedAuthId) {
          await this.recorder.recordEvent(tx, { organizationId: orgId, executionRunId: run.id, eventType: 'execution_authorization.consumed', actorType: 'SYSTEM', correlationId: ctx.correlationId, payload: { actionAuthorizationId: consumedAuthId } });
          await this.recorder.recordEvidence(tx, { organizationId: orgId, executionRunId: run.id, evidenceType: 'AUTHORIZATION', content: { actionAuthorizationId: consumedAuthId, inputHash }, createdByType: 'SYSTEM', correlationId: ctx.correlationId });
        }

        // PENDING → QUEUED + enfileira.
        await this.transitionRun(tx, run, 'QUEUED', { actorType: 'USER', actorId: ctx.userId, correlationId: ctx.correlationId });
        await this.queue.enqueue(tx, { organizationId: orgId, executionRunId: run.id, deduplicationKey: `run:${run.id}`, payload: { executionRunId: run.id } });

        const fresh = (await this.repo.findRun(orgId, run.id, tx))!;
        return { data: toRunContract(fresh) };
      },
    );
    return { statusCode: result.statusCode, body: result.response };
  }

  private resolveExecutor(overrides: Record<string, ExecutorActionKey> | undefined, stepKey: string, producesEvidence: boolean): ExecutorActionKey {
    const override = overrides?.[stepKey];
    if (override) {
      if (!hasExecutor(override)) throw executionNotAllowed(`Executor inválido: ${override}`);
      return override;
    }
    return producesEvidence ? 'evidence.record' : 'system.noop';
  }

  /** Valida a autorização contra a execução e a consome (ACTIVE→USED) na tx. */
  private async validateAndConsumeAuthorization(
    tx: Prisma.TransactionClient,
    orgId: string,
    authorizationId: string,
    ctx: { actionKey: string; operationId: string; operationVersionId: string; inputHash: string; now: Date },
  ): Promise<string> {
    const auth = await tx.actionAuthorization.findFirst({ where: { id: authorizationId, organizationId: orgId } });
    if (!auth) throw notFound('Autorização não encontrada.');
    if (auth.actionKey !== ctx.actionKey || auth.operationId !== ctx.operationId || auth.operationVersionId !== ctx.operationVersionId || auth.actionPayloadHash !== ctx.inputHash) {
      throw authorizationPayloadMismatch();
    }
    if (auth.status === 'USED') throw authorizationAlreadyUsed();
    if (auth.status === 'INVALIDATED') throw authorizationInvalidated();
    if (auth.status === 'EXPIRED') throw authorizationExpired();
    if (auth.status !== 'ACTIVE') throw authorizationAlreadyUsed(`Autorização em estado ${auth.status}.`);
    if (auth.validUntil && auth.validUntil < ctx.now) throw authorizationExpired();
    const consumed = await tx.actionAuthorization.updateMany({ where: { id: authorizationId, organizationId: orgId, status: 'ACTIVE' }, data: { status: 'USED', usedAt: ctx.now, revision: { increment: 1 } } });
    if (consumed.count === 0) throw authorizationAlreadyUsed();
    return authorizationId;
  }

  /** Transição guardada do run + evento `execution.<status>`. */
  private async transitionRun(
    tx: Prisma.TransactionClient,
    run: DbRun,
    target: DbRun['status'],
    actor: { actorType: 'USER' | 'SYSTEM' | 'WORKER'; actorId?: string | null; correlationId: string },
    extra: Prisma.ExecutionRunUncheckedUpdateInput = {},
  ): Promise<void> {
    if (!canTransition(run.status, target)) {
      throw executionNotAllowed(`Transição inválida ${run.status} → ${target}.`);
    }
    await tx.executionRun.updateMany({ where: { id: run.id, organizationId: run.organizationId, status: run.status }, data: { status: target, revision: { increment: 1 }, ...extra } });
    await this.recorder.recordEvent(tx, {
      organizationId: run.organizationId, executionRunId: run.id, eventType: `execution.${target.toLowerCase()}`,
      actorType: actor.actorType, actorId: actor.actorId ?? null, correlationId: actor.correlationId, payload: { from: run.status, to: target },
    });
  }

  // ── Comandos (cooperativos, persistidos) ───────────────────────────────────────
  private async command(
    ctx: AuthenticatedRequestContext,
    id: string,
    body: ExecutionCommandRequest,
    target: DbRun['status'],
    allowedFrom: DbRun['status'][],
    reject: () => never,
    afterEnqueue = false,
  ): Promise<{ data: ExecutionRun }> {
    const orgId = this.orgId(ctx);
    const run = await this.loadRun(ctx, id);
    assertRevision({ resourceType: 'execution_run', resourceId: run.id, expectedRevision: body.expectedRevision, currentRevision: run.revision });
    if (!allowedFrom.includes(run.status)) reject();
    const fresh = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT 1 FROM execution_runs WHERE id = ${id}::uuid FOR UPDATE`;
      const locked = (await this.repo.findRun(orgId, id, tx))!;
      if (!allowedFrom.includes(locked.status)) reject();
      await this.transitionRun(tx, locked, target, { actorType: 'USER', actorId: ctx.userId, correlationId: ctx.correlationId });
      if (afterEnqueue) {
        // resume/retry: recoloca na fila para o worker retomar do ponto correto.
        const requeued = (await this.repo.findRun(orgId, id, tx))!;
        await this.transitionRun(tx, requeued, 'QUEUED', { actorType: 'SYSTEM', actorId: ctx.userId, correlationId: ctx.correlationId });
        await this.queue.enqueue(tx, { organizationId: orgId, executionRunId: id, deduplicationKey: `run:${id}:${requeued.revision}`, payload: { executionRunId: id } });
      }
      return (await this.repo.findRun(orgId, id, tx))!;
    });
    return { data: toRunContract(fresh) };
  }

  pause(ctx: AuthenticatedRequestContext, id: string, body: ExecutionCommandRequest) {
    return this.command(ctx, id, body, 'PAUSE_REQUESTED', ['QUEUED', 'RUNNING'], () => { throw executionNotPausable(); });
  }

  resume(ctx: AuthenticatedRequestContext, id: string, body: ExecutionCommandRequest) {
    return this.command(ctx, id, body, 'RESUME_REQUESTED', ['PAUSED'], () => { throw executionNotResumable(); }, true);
  }

  cancel(ctx: AuthenticatedRequestContext, id: string, body: ExecutionCommandRequest) {
    return this.command(ctx, id, body, 'CANCEL_REQUESTED', ['PENDING', 'QUEUED', 'RUNNING', 'PAUSE_REQUESTED', 'PAUSED'], () => { throw executionNotCancellable(); });
  }

  retry(ctx: AuthenticatedRequestContext, id: string, body: ExecutionCommandRequest) {
    return this.command(ctx, id, body, 'QUEUED', ['FAILED', 'TIMED_OUT'], () => { throw executionNotRetryable(); }, false);
  }
}
