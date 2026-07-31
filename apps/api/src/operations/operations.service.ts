/**
 * Arden.AS API — serviço de operações (ARDEN-BE-003).
 *
 * Fonte de verdade das operações. Todas as leituras/escritas são escopadas pelo
 * tenant validado (`ctx.organizationId`). Comandos críticos (create/duplicate/
 * archive) são idempotentes e transacionais; edição/pause/resume usam concorrência
 * otimista (`expectedRevision`). Toda ação gera auditoria na MESMA transação.
 */

import { Injectable } from '@nestjs/common';
import type { Prisma, Operation as DbOperation, OperationVersion as DbVersion } from '@prisma/client';
import {
  type CreateOperationRequest,
  type UpdateOperationRequest,
  type ArchiveOperationRequest,
  type OperationTransitionRequest,
  type DuplicateOperationRequest,
  type ListOperationsQuery,
  type Operation,
  type PaginationMeta,
} from '@arden/contracts';
import { PrismaService } from '../database/prisma.service';
import { IdempotencyService } from '../modules/idempotency/idempotency.service';
import { AuditRecorder } from '../audit/audit.recorder';
import {
  notFound,
  invalidStateTransition,
  validationError,
} from '../common/errors/api-error';
import { assertRevision } from '../common/concurrency/optimistic-concurrency';
import type { AuthenticatedRequestContext } from '../identity/request-context';
import { OperationsRepository } from './operations.repository';
import { OperationVersionsRepository } from './operation-versions.repository';
import { runIdempotentCommand } from './command.helpers';
import {
  toOperationContract,
  NEUTRAL_DEFINITION,
  NEUTRAL_AUTHORITY_PROFILE,
} from './operation.serializers';

export interface OperationEnvelope {
  data: Operation;
}
export interface OperationListEnvelope {
  data: Operation[];
  pagination: PaginationMeta;
}

@Injectable()
export class OperationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly operations: OperationsRepository,
    private readonly versions: OperationVersionsRepository,
    private readonly audit: AuditRecorder,
    private readonly idem: IdempotencyService,
  ) {}

  private orgId(ctx: AuthenticatedRequestContext): string {
    return ctx.organizationId as string;
  }

  /** Confere que o `ownerId` (se informado) é membro ativo do tenant. */
  private async assertOwnerInTenant(ctx: AuthenticatedRequestContext, ownerId?: string | null): Promise<void> {
    if (!ownerId) return;
    const membership = await this.prisma.membership.findFirst({
      where: { userId: ownerId, organizationId: this.orgId(ctx), status: 'ACTIVE' },
      select: { id: true },
    });
    if (!membership) {
      throw validationError(
        [{ field: 'ownerId', code: 'OWNER_NOT_IN_TENANT', message: 'Responsável não é membro do tenant.' }],
        'Responsável inválido.',
      );
    }
  }

  private async loadOrThrow(ctx: AuthenticatedRequestContext, operationId: string): Promise<DbOperation> {
    const op = await this.operations.findById(this.orgId(ctx), operationId);
    if (!op) throw notFound('Operação não encontrada.');
    return op;
  }

  async list(ctx: AuthenticatedRequestContext, query: ListOperationsQuery): Promise<OperationListEnvelope> {
    const page = await this.operations.list(this.orgId(ctx), query);
    return {
      data: page.rows.map(toOperationContract),
      pagination: {
        cursor: query.cursor ?? null,
        nextCursor: page.nextCursor,
        hasNextPage: page.hasNextPage,
        limit: query.limit,
      },
    };
  }

  async get(ctx: AuthenticatedRequestContext, operationId: string): Promise<OperationEnvelope> {
    return { data: toOperationContract(await this.loadOrThrow(ctx, operationId)) };
  }

  // ── Criação transacional (operação + 1ª versão em rascunho + auditoria) ────────
  async create(
    ctx: AuthenticatedRequestContext,
    body: CreateOperationRequest,
    idempotencyKey: string,
  ): Promise<{ statusCode: number; body: OperationEnvelope }> {
    const orgId = this.orgId(ctx);

    const result = await runIdempotentCommand<OperationEnvelope>(
      { idem: this.idem, prisma: this.prisma },
      { method: 'POST', path: `/organizations/${orgId}/operations`, idempotencyKey, userId: ctx.userId, organizationId: orgId },
      body,
      201,
      async (tx) => {
        const op = await this.operations.create(
          {
            organizationId: orgId,
            name: body.name,
            description: body.description ?? null,
            status: 'draft',
            ownerId: body.ownerId ?? null,
            createdBy: ctx.userId,
          },
          tx,
        );
        const version = await this.versions.create(
          {
            organizationId: orgId,
            operationId: op.id,
            versionNumber: 1,
            status: 'draft',
            definition: NEUTRAL_DEFINITION as unknown as Prisma.InputJsonValue,
            authorityProfile: NEUTRAL_AUTHORITY_PROFILE as unknown as Prisma.InputJsonValue,
            createdBy: ctx.userId,
          },
          tx,
        );
        const withPointer = await tx.operation.update({
          where: { id: op.id },
          data: { currentDraftVersionId: version.id },
        });

        await this.recordOp(tx, ctx, 'operation.created', op.id, null, withPointer, {
          sourceAssessmentId: body.sourceAssessmentId ?? null,
        });
        await this.recordVersion(tx, ctx, 'operation_version.created', version.id, null, version);

        return { data: toOperationContract(withPointer) };
      },
      async () => {
        await this.assertOwnerInTenant(ctx, body.ownerId ?? null);
      },
    );
    return { statusCode: result.statusCode, body: result.response };
  }

  // ── Edição de metadados (concorrência otimista) ────────────────────────────────
  async update(
    ctx: AuthenticatedRequestContext,
    operationId: string,
    body: UpdateOperationRequest,
  ): Promise<OperationEnvelope> {
    const op = await this.loadOrThrow(ctx, operationId);
    if (op.status === 'archived') {
      throw invalidStateTransition('Operação arquivada não pode ser editada.');
    }
    assertRevision({ resourceType: 'operation', resourceId: op.id, expectedRevision: body.expectedRevision, currentRevision: op.revision });
    if (body.ownerId !== undefined) await this.assertOwnerInTenant(ctx, body.ownerId);

    const data: Prisma.OperationUncheckedUpdateInput = { revision: { increment: 1 } };
    if (body.name !== undefined) data.name = body.name;
    if (body.description !== undefined) data.description = body.description;
    if (body.ownerId !== undefined) data.ownerId = body.ownerId;

    const updated = await this.prisma.$transaction(async (tx) => {
      const res = await tx.operation.updateMany({
        where: { id: op.id, organizationId: op.organizationId, revision: body.expectedRevision },
        data,
      });
      if (res.count === 0) {
        assertRevision({ resourceType: 'operation', resourceId: op.id, expectedRevision: body.expectedRevision, currentRevision: op.revision + 1 });
      }
      const fresh = (await this.operations.findById(op.organizationId, op.id, tx))!;
      await this.recordOp(tx, ctx, 'operation.updated', op.id, op, fresh);
      return fresh;
    });
    return { data: toOperationContract(updated) };
  }

  // ── Pausar / retomar (concorrência otimista + idempotência por estado) ─────────
  async pause(ctx: AuthenticatedRequestContext, operationId: string, body: OperationTransitionRequest): Promise<OperationEnvelope> {
    const op = await this.loadOrThrow(ctx, operationId);
    if (op.status === 'paused') return { data: toOperationContract(op) }; // idempotente
    if (op.status !== 'active') throw invalidStateTransition('Apenas operação ativa pode ser pausada.');
    return this.transition(ctx, op, body.expectedRevision, 'paused', 'operation.paused');
  }

  async resume(ctx: AuthenticatedRequestContext, operationId: string, body: OperationTransitionRequest): Promise<OperationEnvelope> {
    const op = await this.loadOrThrow(ctx, operationId);
    if (op.status === 'active') return { data: toOperationContract(op) }; // idempotente
    if (op.status !== 'paused') throw invalidStateTransition('Apenas operação pausada pode ser retomada.');
    if (!op.publishedVersionId) throw invalidStateTransition('Retomar exige uma versão publicada.');
    return this.transition(ctx, op, body.expectedRevision, 'active', 'operation.resumed');
  }

  private async transition(
    ctx: AuthenticatedRequestContext,
    op: DbOperation,
    expectedRevision: number,
    status: 'active' | 'paused',
    action: string,
  ): Promise<OperationEnvelope> {
    assertRevision({ resourceType: 'operation', resourceId: op.id, expectedRevision, currentRevision: op.revision });
    const updated = await this.prisma.$transaction(async (tx) => {
      const res = await tx.operation.updateMany({
        where: { id: op.id, organizationId: op.organizationId, revision: expectedRevision },
        data: { status, revision: { increment: 1 } },
      });
      if (res.count === 0) {
        assertRevision({ resourceType: 'operation', resourceId: op.id, expectedRevision, currentRevision: op.revision + 1 });
      }
      const fresh = (await this.operations.findById(op.organizationId, op.id, tx))!;
      await this.recordOp(tx, ctx, action, op.id, op, fresh);
      return fresh;
    });
    return { data: toOperationContract(updated) };
  }

  // ── Arquivar (idempotente + concorrência) ──────────────────────────────────────
  async archive(
    ctx: AuthenticatedRequestContext,
    operationId: string,
    body: ArchiveOperationRequest,
    idempotencyKey: string,
  ): Promise<{ statusCode: number; body: OperationEnvelope }> {
    const orgId = this.orgId(ctx);

    const result = await runIdempotentCommand<OperationEnvelope, DbOperation>(
      { idem: this.idem, prisma: this.prisma },
      { method: 'POST', path: `/organizations/${orgId}/operations/${operationId}/archive`, idempotencyKey, userId: ctx.userId, organizationId: orgId },
      body,
      200,
      async (tx, op) => {
        if (op.status === 'archived') return { data: toOperationContract(op) };
        assertRevision({ resourceType: 'operation', resourceId: op.id, expectedRevision: body.expectedRevision, currentRevision: op.revision });
        const res = await tx.operation.updateMany({
          where: { id: op.id, organizationId: orgId, revision: body.expectedRevision },
          data: { status: 'archived', revision: { increment: 1 } },
        });
        if (res.count === 0) {
          assertRevision({ resourceType: 'operation', resourceId: op.id, expectedRevision: body.expectedRevision, currentRevision: op.revision + 1 });
        }
        const fresh = (await this.operations.findById(orgId, op.id, tx))!;
        await this.recordOp(tx, ctx, 'operation.archived', op.id, op, fresh, { reason: body.reason ?? null });
        return { data: toOperationContract(fresh) };
      },
      () => this.loadOrThrow(ctx, operationId),
    );
    return { statusCode: result.statusCode, body: result.response };
  }

  // ── Duplicação (idempotente) ───────────────────────────────────────────────────
  async duplicate(
    ctx: AuthenticatedRequestContext,
    operationId: string,
    body: DuplicateOperationRequest,
    idempotencyKey: string,
  ): Promise<{ statusCode: number; body: OperationEnvelope }> {
    const orgId = this.orgId(ctx);

    const result = await runIdempotentCommand<OperationEnvelope, { source: DbOperation; sourceVersion: DbVersion | null }>(
      { idem: this.idem, prisma: this.prisma },
      { method: 'POST', path: `/organizations/${orgId}/operations/${operationId}/duplicate`, idempotencyKey, userId: ctx.userId, organizationId: orgId },
      body,
      201,
      async (tx, { source, sourceVersion }) => {
        const op = await this.operations.create(
          {
            organizationId: orgId,
            name: body.name ?? `${source.name} (cópia)`,
            description: source.description,
            status: 'draft',
            ownerId: source.ownerId,
            createdBy: ctx.userId,
          },
          tx,
        );
        const version = await this.versions.create(
          {
            organizationId: orgId,
            operationId: op.id,
            versionNumber: 1,
            status: 'draft',
            definition: (sourceVersion?.definition ?? (NEUTRAL_DEFINITION as unknown)) as Prisma.InputJsonValue,
            authorityProfile: (sourceVersion?.authorityProfile ?? (NEUTRAL_AUTHORITY_PROFILE as unknown)) as Prisma.InputJsonValue,
            changeSummary: `Duplicada de ${source.id}`,
            createdBy: ctx.userId,
          },
          tx,
        );
        const withPointer = await tx.operation.update({
          where: { id: op.id },
          data: { currentDraftVersionId: version.id },
        });
        await this.recordOp(tx, ctx, 'operation.duplicated', op.id, null, withPointer, { sourceOperationId: source.id });
        await this.recordVersion(tx, ctx, 'operation_version.created', version.id, null, version);
        return { data: toOperationContract(withPointer) };
      },
      async () => {
        const source = await this.loadOrThrow(ctx, operationId);
        const sourceVersion =
          (await this.versions.findPublished(orgId, source.id)) ??
          (await this.versions.findCurrentDraft(orgId, source.id));
        return { source, sourceVersion };
      },
    );
    return { statusCode: result.statusCode, body: result.response };
  }

  // ── Auditoria (helpers internos) ───────────────────────────────────────────────
  private recordOp(
    tx: Prisma.TransactionClient,
    ctx: AuthenticatedRequestContext,
    action: string,
    resourceId: string,
    before: DbOperation | null,
    after: DbOperation | null,
    metadata: Record<string, unknown> = {},
  ) {
    return this.audit.record(tx, {
      organizationId: this.orgId(ctx),
      actorUserId: ctx.userId,
      action,
      resourceType: 'operation',
      resourceId,
      correlationId: ctx.correlationId,
      before: before ? toOperationContract(before) : null,
      after: after ? toOperationContract(after) : null,
      metadata,
    });
  }

  private recordVersion(
    tx: Prisma.TransactionClient,
    ctx: AuthenticatedRequestContext,
    action: string,
    resourceId: string,
    before: DbVersion | null,
    after: DbVersion | null,
  ) {
    return this.audit.record(tx, {
      organizationId: this.orgId(ctx),
      actorUserId: ctx.userId,
      action,
      resourceType: 'operation_version',
      resourceId,
      correlationId: ctx.correlationId,
      before: before ? { versionNumber: before.versionNumber, status: before.status } : null,
      after: after ? { versionNumber: after.versionNumber, status: after.status } : null,
      metadata: {},
    });
  }
}
