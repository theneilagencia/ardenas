/**
 * Arden.AS API — serviço de versões de operação (ARDEN-BE-003).
 *
 * Rascunho editável (concorrência otimista), imutabilidade de versões publicadas,
 * criação de nova versão (um único rascunho ativo), comparação estruturada e
 * PUBLICAÇÃO TRANSACIONAL (validação → supersede → publish → ponteiros → auditoria
 * → idempotência, tudo em uma transação; falha → rollback total). Gradiente de
 * Autoridade consultado/definido no rascunho.
 */

import { Injectable } from '@nestjs/common';
import type { Prisma, Operation as DbOperation, OperationVersion as DbVersion, AuditEvent as DbAuditEvent } from '@prisma/client';
import {
  type CreateOperationVersionRequest,
  type UpdateOperationVersionRequest,
  type PublishOperationVersionRequest,
  type UpdateAuthorityProfileRequest,
  type OperationVersion,
  type VersionComparison,
  type PublishOperationVersionResult,
  type AuthorityProfile,
  type PaginationMeta,
  operationDefinition,
} from '@arden/contracts';
import { PrismaService } from '../database/prisma.service';
import { IdempotencyService } from '../modules/idempotency/idempotency.service';
import { AuditRecorder } from '../audit/audit.recorder';
import {
  notFound,
  alreadyPublished,
  invalidStateTransition,
  resourceConflict,
  validationError,
} from '../common/errors/api-error';
import { assertRevision } from '../common/concurrency/optimistic-concurrency';
import type { AuthenticatedRequestContext } from '../identity/request-context';
import { OperationsRepository } from './operations.repository';
import { OperationVersionsRepository } from './operation-versions.repository';
import { OperationPublicationValidator } from './publication.validator';
import { runIdempotentCommand } from './command.helpers';
import { diffVersionSnapshots } from './version-diff';
import {
  toOperationContract,
  toOperationVersionContract,
  toAuditEventContract,
  NEUTRAL_DEFINITION,
  NEUTRAL_AUTHORITY_PROFILE,
} from './operation.serializers';

export interface VersionEnvelope {
  data: OperationVersion;
}
export interface VersionListEnvelope {
  data: OperationVersion[];
  pagination: PaginationMeta;
}

@Injectable()
export class OperationVersionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly operations: OperationsRepository,
    private readonly versions: OperationVersionsRepository,
    private readonly validator: OperationPublicationValidator,
    private readonly audit: AuditRecorder,
    private readonly idem: IdempotencyService,
  ) {}

  private orgId(ctx: AuthenticatedRequestContext): string {
    return ctx.organizationId as string;
  }

  private async loadOperationOrThrow(ctx: AuthenticatedRequestContext, operationId: string): Promise<DbOperation> {
    const op = await this.operations.findById(this.orgId(ctx), operationId);
    if (!op) throw notFound('Operação não encontrada.');
    return op;
  }

  private async loadVersionOrThrow(ctx: AuthenticatedRequestContext, operationId: string, versionId: string): Promise<DbVersion> {
    const v = await this.versions.findById(this.orgId(ctx), operationId, versionId);
    if (!v) throw notFound('Versão não encontrada.');
    return v;
  }

  async list(ctx: AuthenticatedRequestContext, operationId: string, limit: number, cursor?: string): Promise<VersionListEnvelope> {
    await this.loadOperationOrThrow(ctx, operationId);
    const page = await this.versions.list(this.orgId(ctx), operationId, limit, cursor);
    return {
      data: page.rows.map(toOperationVersionContract),
      pagination: { cursor: cursor ?? null, nextCursor: page.nextCursor, hasNextPage: page.hasNextPage, limit },
    };
  }

  async get(ctx: AuthenticatedRequestContext, operationId: string, versionId: string): Promise<VersionEnvelope> {
    return { data: toOperationVersionContract(await this.loadVersionOrThrow(ctx, operationId, versionId)) };
  }

  // ── Nova versão (um único rascunho ativo) ──────────────────────────────────────
  async create(
    ctx: AuthenticatedRequestContext,
    operationId: string,
    body: CreateOperationVersionRequest,
    idempotencyKey: string,
  ): Promise<{ statusCode: number; body: VersionEnvelope }> {
    const orgId = this.orgId(ctx);

    const result = await runIdempotentCommand<
      VersionEnvelope,
      { op: DbOperation; base: DbVersion | null; nextNumber: number }
    >(
      { idem: this.idem, prisma: this.prisma },
      { method: 'POST', path: `/organizations/${orgId}/operations/${operationId}/versions`, idempotencyKey, userId: ctx.userId, organizationId: orgId },
      body,
      201,
      async (tx, { op, base, nextNumber }) => {
        const version = await this.versions.create(
          {
            organizationId: orgId,
            operationId: op.id,
            versionNumber: nextNumber,
            status: 'draft',
            definition: (base?.definition ?? (NEUTRAL_DEFINITION as unknown)) as Prisma.InputJsonValue,
            authorityProfile: (base?.authorityProfile ?? (NEUTRAL_AUTHORITY_PROFILE as unknown)) as Prisma.InputJsonValue,
            changeSummary: body.changeSummary ?? null,
            createdBy: ctx.userId,
          },
          tx,
        );
        await tx.operation.update({ where: { id: op.id }, data: { currentDraftVersionId: version.id } });
        await this.recordVersion(tx, ctx, 'operation_version.created', version.id, null, version, {
          basedOnVersionId: base?.id ?? null,
        });
        return { data: toOperationVersionContract(version) };
      },
      async () => {
        const op = await this.loadOperationOrThrow(ctx, operationId);
        if (op.status === 'archived') throw invalidStateTransition('Operação arquivada não aceita novas versões.');
        if (await this.versions.findCurrentDraft(orgId, op.id)) {
          throw resourceConflict('Já existe um rascunho ativo para esta operação.');
        }
        let base: DbVersion | null = null;
        if (body.basedOnVersionId) {
          base = await this.versions.findById(orgId, op.id, body.basedOnVersionId);
          if (!base) throw notFound('Versão de base não encontrada.');
        } else {
          base = await this.versions.findPublished(orgId, op.id);
        }
        const nextNumber = (await this.versions.maxVersionNumber(orgId, op.id)) + 1;
        return { op, base, nextNumber };
      },
    );
    return { statusCode: result.statusCode, body: result.response };
  }

  // ── Edição do rascunho (imutabilidade + concorrência) ──────────────────────────
  async updateDraft(
    ctx: AuthenticatedRequestContext,
    operationId: string,
    versionId: string,
    body: UpdateOperationVersionRequest,
  ): Promise<VersionEnvelope> {
    const version = await this.loadVersionOrThrow(ctx, operationId, versionId);
    if (version.status !== 'draft') throw alreadyPublished('Versão publicada é imutável.');
    assertRevision({ resourceType: 'operation_version', resourceId: version.id, expectedRevision: body.expectedRevision, currentRevision: version.revision });

    const data: Prisma.OperationVersionUncheckedUpdateInput = { revision: { increment: 1 } };
    if (body.definition !== undefined) {
      data.definition = operationDefinition.parse(body.definition) as unknown as Prisma.InputJsonValue;
    }
    if (body.changeSummary !== undefined) data.changeSummary = body.changeSummary;

    const updated = await this.prisma.$transaction(async (tx) => {
      const res = await tx.operationVersion.updateMany({
        where: { id: version.id, organizationId: version.organizationId, status: 'draft', revision: body.expectedRevision },
        data,
      });
      if (res.count === 0) {
        const fresh = await this.versions.findById(version.organizationId, operationId, versionId, tx);
        if (fresh && fresh.status !== 'draft') throw alreadyPublished('Versão publicada é imutável.');
        assertRevision({ resourceType: 'operation_version', resourceId: version.id, expectedRevision: body.expectedRevision, currentRevision: fresh?.revision ?? version.revision });
      }
      const fresh = (await this.versions.findById(version.organizationId, operationId, versionId, tx))!;
      await this.recordVersion(tx, ctx, 'operation_version.updated', version.id, version, fresh);
      return fresh;
    });
    return { data: toOperationVersionContract(updated) };
  }

  // ── Gradiente de Autoridade ────────────────────────────────────────────────────
  async getAuthority(ctx: AuthenticatedRequestContext, operationId: string, versionId: string): Promise<{ data: AuthorityProfile }> {
    const version = await this.loadVersionOrThrow(ctx, operationId, versionId);
    return { data: version.authorityProfile as unknown as AuthorityProfile };
  }

  async updateAuthority(
    ctx: AuthenticatedRequestContext,
    operationId: string,
    versionId: string,
    body: UpdateAuthorityProfileRequest,
  ): Promise<VersionEnvelope> {
    const version = await this.loadVersionOrThrow(ctx, operationId, versionId);
    if (version.status !== 'draft') throw alreadyPublished('Versão publicada é imutável.');
    assertRevision({ resourceType: 'operation_version', resourceId: version.id, expectedRevision: body.expectedRevision, currentRevision: version.revision });

    const updated = await this.prisma.$transaction(async (tx) => {
      const res = await tx.operationVersion.updateMany({
        where: { id: version.id, organizationId: version.organizationId, status: 'draft', revision: body.expectedRevision },
        data: { authorityProfile: body.authorityProfile as unknown as Prisma.InputJsonValue, revision: { increment: 1 } },
      });
      if (res.count === 0) {
        const fresh = await this.versions.findById(version.organizationId, operationId, versionId, tx);
        if (fresh && fresh.status !== 'draft') throw alreadyPublished('Versão publicada é imutável.');
        assertRevision({ resourceType: 'operation_version', resourceId: version.id, expectedRevision: body.expectedRevision, currentRevision: fresh?.revision ?? version.revision });
      }
      const fresh = (await this.versions.findById(version.organizationId, operationId, versionId, tx))!;
      await this.recordVersion(tx, ctx, 'authority_profile.updated', version.id, version, fresh);
      return fresh;
    });
    return { data: toOperationVersionContract(updated) };
  }

  // ── Comparação ─────────────────────────────────────────────────────────────────
  async compare(
    ctx: AuthenticatedRequestContext,
    operationId: string,
    versionId: string,
    otherVersionId: string,
  ): Promise<{ data: VersionComparison }> {
    const base = await this.loadVersionOrThrow(ctx, operationId, versionId);
    const other = await this.loadVersionOrThrow(ctx, operationId, otherVersionId);
    const differences = diffVersionSnapshots(
      { definition: base.definition, authorityProfile: base.authorityProfile },
      { definition: other.definition, authorityProfile: other.authorityProfile },
    );
    return {
      data: {
        base: { versionId: base.id, versionNumber: base.versionNumber },
        other: { versionId: other.id, versionNumber: other.versionNumber },
        differences,
      },
    };
  }

  // ── Publicação transacional ────────────────────────────────────────────────────
  async publish(
    ctx: AuthenticatedRequestContext,
    operationId: string,
    versionId: string,
    body: PublishOperationVersionRequest,
    idempotencyKey: string,
  ): Promise<{ statusCode: number; body: { data: PublishOperationVersionResult } }> {
    const orgId = this.orgId(ctx);

    const result = await runIdempotentCommand<
      { data: PublishOperationVersionResult },
      { op: DbOperation; version: DbVersion; warnings: unknown[] }
    >(
      { idem: this.idem, prisma: this.prisma },
      { method: 'POST', path: `/organizations/${orgId}/operations/${operationId}/versions/${versionId}/publish`, idempotencyKey, userId: ctx.userId, organizationId: orgId },
      body,
      200,
      async (tx, { op, version, warnings }) => {
        const audits: DbAuditEvent[] = [];
        audits.push(
          await this.recordVersion(tx, ctx, 'operation_version.publication_validated', version.id, version, version, {
            warnings,
          }),
        );

        // 1. Transição atômica draft → published (guarda status + revisão).
        const publishRes = await tx.operationVersion.updateMany({
          where: { id: version.id, organizationId: orgId, operationId: op.id, status: 'draft', revision: body.expectedRevision },
          data: { status: 'published', publishedBy: ctx.userId, publishedAt: new Date(), changeSummary: body.changeSummary, revision: { increment: 1 } },
        });
        if (publishRes.count === 0) {
          const fresh = await this.versions.findById(orgId, op.id, version.id, tx);
          if (fresh && fresh.status !== 'draft') throw alreadyPublished('Versão já publicada é imutável.');
          assertRevision({ resourceType: 'operation_version', resourceId: version.id, expectedRevision: body.expectedRevision, currentRevision: fresh?.revision ?? version.revision });
        }

        // 2. Supersede da versão publicada anterior (se houver e for outra).
        if (op.publishedVersionId && op.publishedVersionId !== version.id) {
          const prev = await this.versions.findById(orgId, op.id, op.publishedVersionId, tx);
          if (prev && prev.status === 'published') {
            await tx.operationVersion.updateMany({
              where: { id: prev.id, organizationId: orgId, status: 'published' },
              data: { status: 'superseded', revision: { increment: 1 } },
            });
            audits.push(await this.recordVersion(tx, ctx, 'operation_version.superseded', prev.id, prev, null));
          }
        }

        // 3. Atualiza a operação: ponteiros + status active quando aplicável.
        const nextStatus = op.status === 'draft' ? 'active' : op.status;
        await tx.operation.updateMany({
          where: { id: op.id, organizationId: orgId },
          data: { publishedVersionId: version.id, currentDraftVersionId: null, status: nextStatus, revision: { increment: 1 } },
        });

        // 3.1. Invalidação por mudança material (ARDEN-BE-004 §36): publicar uma
        // nova versão de autoridade torna STALE toda solicitação PENDENTE e toda
        // autorização ATIVA presas à autoridade anterior. O histórico é preservado
        // (status → INVALIDATED, nada é apagado).
        const invalidatedRequests = await tx.approvalRequest.updateMany({
          where: { organizationId: orgId, operationId: op.id, status: 'PENDING', operationVersionId: { not: version.id } },
          data: { status: 'INVALIDATED', decidedAt: new Date(), revision: { increment: 1 } },
        });
        const invalidatedAuths = await tx.actionAuthorization.updateMany({
          where: { organizationId: orgId, operationId: op.id, status: 'ACTIVE', operationVersionId: { not: version.id } },
          data: { status: 'INVALIDATED', revision: { increment: 1 } },
        });
        if (invalidatedRequests.count > 0 || invalidatedAuths.count > 0) {
          audits.push(
            await this.audit.record(tx, {
              organizationId: orgId, actorUserId: ctx.userId, action: 'authority.invalidated_by_publish',
              resourceType: 'operation', resourceId: op.id, correlationId: ctx.correlationId,
              metadata: { publishedVersionId: version.id, invalidatedRequests: invalidatedRequests.count, invalidatedAuthorizations: invalidatedAuths.count },
            }),
          );
        }

        const publishedVersion = (await this.versions.findById(orgId, op.id, version.id, tx))!;
        const updatedOp = (await this.operations.findById(orgId, op.id, tx))!;

        audits.push(await this.recordVersion(tx, ctx, 'operation_version.published', version.id, version, publishedVersion));
        audits.push(await this.recordOp(tx, ctx, 'operation.updated', op.id, op, updatedOp));

        return {
          data: {
            version: toOperationVersionContract(publishedVersion),
            operation: toOperationContract(updatedOp),
            auditEvents: audits.map(toAuditEventContract),
          },
        };
      },
      async () => {
        const op = await this.loadOperationOrThrow(ctx, operationId);
        const version = await this.loadVersionOrThrow(ctx, operationId, versionId);
        if (version.status !== 'draft') throw alreadyPublished('Versão já publicada é imutável.');
        if (op.status === 'archived') throw invalidStateTransition('Operação arquivada não pode publicar.');

        // Validação ANTES da transação: inválido → auditoria de falha (best-effort,
        // fora da transação) + 422; a transação nem inicia.
        const validation = this.validator.validate(op, version, ctx);
        if (!validation.valid) {
          await this.audit
            .record(this.prisma as unknown as Prisma.TransactionClient, {
              organizationId: orgId,
              actorUserId: ctx.userId,
              action: 'operation_version.publication_failed',
              resourceType: 'operation_version',
              resourceId: version.id,
              outcome: 'FAILURE',
              correlationId: ctx.correlationId,
              metadata: { errors: validation.errors },
            })
            .catch(() => undefined);
          throw validationError(
            validation.errors.map((e) => ({ field: e.field ?? 'version', code: e.code, message: e.message })),
            'Publicação inválida.',
          );
        }
        return { op, version, warnings: validation.warnings };
      },
    );
    return { statusCode: result.statusCode, body: result.response };
  }

  // ── Auditoria (helpers) ────────────────────────────────────────────────────────
  private recordVersion(
    tx: Prisma.TransactionClient,
    ctx: AuthenticatedRequestContext,
    action: string,
    resourceId: string,
    before: DbVersion | null,
    after: DbVersion | null,
    metadata: Record<string, unknown> = {},
  ): Promise<DbAuditEvent> {
    return this.audit.record(tx, {
      organizationId: this.orgId(ctx),
      actorUserId: ctx.userId,
      action,
      resourceType: 'operation_version',
      resourceId,
      correlationId: ctx.correlationId,
      before: before ? { versionNumber: before.versionNumber, status: before.status, revision: before.revision } : null,
      after: after ? { versionNumber: after.versionNumber, status: after.status, revision: after.revision } : null,
      metadata,
    });
  }

  private recordOp(
    tx: Prisma.TransactionClient,
    ctx: AuthenticatedRequestContext,
    action: string,
    resourceId: string,
    before: DbOperation | null,
    after: DbOperation | null,
  ): Promise<DbAuditEvent> {
    return this.audit.record(tx, {
      organizationId: this.orgId(ctx),
      actorUserId: ctx.userId,
      action,
      resourceType: 'operation',
      resourceId,
      correlationId: ctx.correlationId,
      before: before ? toOperationContract(before) : null,
      after: after ? toOperationContract(after) : null,
      metadata: {},
    });
  }
}
