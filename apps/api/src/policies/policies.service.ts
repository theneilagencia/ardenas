/**
 * Arden.AS API — serviço de políticas (ARDEN-BE-004).
 *
 * Políticas versionadas: criação transacional (política + 1ª versão em rascunho),
 * edição do rascunho (imutabilidade da publicada), publicação transacional
 * (supersede + ponteiros), suspensão/arquivamento e vínculos a operações. Tenant
 * sempre validado; concorrência otimista; idempotência; auditoria na transação.
 */

import { Injectable } from '@nestjs/common';
import type { Prisma, Policy as DbPolicy, PolicyVersion as DbPolicyVersion } from '@prisma/client';
import {
  policyDefinition,
  type CreatePolicyRequest,
  type UpdatePolicyRequest,
  type CreatePolicyVersionRequest,
  type UpdatePolicyVersionRequest,
  type PublishPolicyVersionRequest,
  type PolicyTransitionRequest,
  type CreatePolicyBindingRequest,
  type UpdatePolicyBindingRequest,
  type Policy,
  type PolicyVersion,
  type OperationPolicyBinding,
  type PaginationMeta,
} from '@arden/contracts';
import { PrismaService } from '../database/prisma.service';
import { IdempotencyService } from '../modules/idempotency/idempotency.service';
import { AuditRecorder } from '../audit/audit.recorder';
import { notFound, alreadyPublished, invalidStateTransition, resourceConflict } from '../common/errors/api-error';
import { assertRevision } from '../common/concurrency/optimistic-concurrency';
import type { AuthenticatedRequestContext } from '../identity/request-context';
import { runIdempotentCommand } from '../operations/command.helpers';
import { PoliciesRepository } from './policies.repository';
import { toPolicyContract, toPolicyVersionContract, toBindingContract, NEUTRAL_POLICY_DEFINITION } from './policy.serializers';

@Injectable()
export class PoliciesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repo: PoliciesRepository,
    private readonly audit: AuditRecorder,
    private readonly idem: IdempotencyService,
  ) {}

  private orgId(ctx: AuthenticatedRequestContext): string {
    return ctx.organizationId as string;
  }

  private auditPolicy(tx: Prisma.TransactionClient, ctx: AuthenticatedRequestContext, action: string, id: string, before: unknown, after: unknown) {
    return this.audit.record(tx, {
      organizationId: this.orgId(ctx), actorUserId: ctx.userId, action,
      resourceType: 'policy', resourceId: id, correlationId: ctx.correlationId,
      before: before ?? null, after: after ?? null, metadata: {},
    });
  }

  async list(ctx: AuthenticatedRequestContext, limit: number, cursor?: string): Promise<{ data: Policy[]; pagination: PaginationMeta }> {
    const rows = await this.repo.listPolicies(this.orgId(ctx), limit + 1, cursor);
    const hasNextPage = rows.length > limit;
    const page = hasNextPage ? rows.slice(0, limit) : rows;
    const last = page[page.length - 1];
    return {
      data: page.map(toPolicyContract),
      pagination: { cursor: cursor ?? null, nextCursor: hasNextPage && last ? last.createdAt.toISOString() : null, hasNextPage, limit },
    };
  }

  private async loadPolicy(ctx: AuthenticatedRequestContext, id: string): Promise<DbPolicy> {
    const p = await this.repo.findPolicy(this.orgId(ctx), id);
    if (!p) throw notFound('Política não encontrada.');
    return p;
  }

  async get(ctx: AuthenticatedRequestContext, id: string): Promise<{ data: Policy }> {
    return { data: toPolicyContract(await this.loadPolicy(ctx, id)) };
  }

  async create(ctx: AuthenticatedRequestContext, body: CreatePolicyRequest, key: string): Promise<{ statusCode: number; body: { data: Policy } }> {
    const orgId = this.orgId(ctx);
    const result = await runIdempotentCommand<{ data: Policy }>(
      { idem: this.idem, prisma: this.prisma },
      { method: 'POST', path: `/organizations/${orgId}/policies`, idempotencyKey: key, userId: ctx.userId, organizationId: orgId },
      body, 201,
      async (tx) => {
        const existing = await tx.policy.findFirst({ where: { organizationId: orgId, key: body.key }, select: { id: true } });
        if (existing) throw resourceConflict('Já existe uma política com esta chave.');
        const policy = await this.repo.createPolicy(
          { organizationId: orgId, key: body.key, name: body.name, description: body.description ?? null, category: body.category, status: 'DRAFT', createdBy: ctx.userId },
          tx,
        );
        const version = await this.repo.createVersion(
          { organizationId: orgId, policyId: policy.id, versionNumber: 1, status: 'DRAFT', definition: NEUTRAL_POLICY_DEFINITION as unknown as Prisma.InputJsonValue, createdBy: ctx.userId },
          tx,
        );
        const withPointer = await tx.policy.update({ where: { id: policy.id }, data: { currentDraftVersionId: version.id } });
        await this.auditPolicy(tx, ctx, 'policy.created', policy.id, null, toPolicyContract(withPointer));
        await this.audit.record(tx, { organizationId: orgId, actorUserId: ctx.userId, action: 'policy.version_created', resourceType: 'policy_version', resourceId: version.id, correlationId: ctx.correlationId, metadata: {} });
        return { data: toPolicyContract(withPointer) };
      },
    );
    return { statusCode: result.statusCode, body: result.response };
  }

  async update(ctx: AuthenticatedRequestContext, id: string, body: UpdatePolicyRequest): Promise<{ data: Policy }> {
    const p = await this.loadPolicy(ctx, id);
    if (p.status === 'ARCHIVED') throw invalidStateTransition('Política arquivada não pode ser editada.');
    assertRevision({ resourceType: 'policy', resourceId: p.id, expectedRevision: body.expectedRevision, currentRevision: p.revision });
    const data: Prisma.PolicyUncheckedUpdateInput = { revision: { increment: 1 } };
    if (body.name !== undefined) data.name = body.name;
    if (body.description !== undefined) data.description = body.description;
    const updated = await this.prisma.$transaction(async (tx) => {
      const res = await tx.policy.updateMany({ where: { id: p.id, organizationId: p.organizationId, revision: body.expectedRevision }, data });
      if (res.count === 0) assertRevision({ resourceType: 'policy', resourceId: p.id, expectedRevision: body.expectedRevision, currentRevision: p.revision + 1 });
      const fresh = (await this.repo.findPolicy(p.organizationId, p.id, tx))!;
      await this.auditPolicy(tx, ctx, 'policy.updated', p.id, toPolicyContract(p), toPolicyContract(fresh));
      return fresh;
    });
    return { data: toPolicyContract(updated) };
  }

  async createVersion(ctx: AuthenticatedRequestContext, policyId: string, body: CreatePolicyVersionRequest, key: string): Promise<{ statusCode: number; body: { data: PolicyVersion } }> {
    const orgId = this.orgId(ctx);
    const result = await runIdempotentCommand<{ data: PolicyVersion }, { base: DbPolicyVersion | null; next: number }>(
      { idem: this.idem, prisma: this.prisma },
      { method: 'POST', path: `/organizations/${orgId}/policies/${policyId}/versions`, idempotencyKey: key, userId: ctx.userId, organizationId: orgId },
      body, 201,
      async (tx, { base, next }) => {
        const version = await this.repo.createVersion(
          { organizationId: orgId, policyId, versionNumber: next, status: 'DRAFT', definition: (base?.definition ?? (NEUTRAL_POLICY_DEFINITION as unknown)) as Prisma.InputJsonValue, changeSummary: body.changeSummary ?? null, createdBy: ctx.userId },
          tx,
        );
        await tx.policy.update({ where: { id: policyId }, data: { currentDraftVersionId: version.id } });
        await this.audit.record(tx, { organizationId: orgId, actorUserId: ctx.userId, action: 'policy.version_created', resourceType: 'policy_version', resourceId: version.id, correlationId: ctx.correlationId, metadata: {} });
        return { data: toPolicyVersionContract(version) };
      },
      async () => {
        await this.loadPolicy(ctx, policyId);
        if (await this.repo.findCurrentDraft(orgId, policyId)) throw resourceConflict('Já existe um rascunho ativo.');
        const base = body.basedOnVersionId ? await this.repo.findVersion(orgId, policyId, body.basedOnVersionId) : await this.repo.findPublishedVersion(orgId, policyId);
        if (body.basedOnVersionId && !base) throw notFound('Versão de base não encontrada.');
        return { base, next: (await this.repo.maxVersionNumber(orgId, policyId)) + 1 };
      },
    );
    return { statusCode: result.statusCode, body: result.response };
  }

  async updateDraft(ctx: AuthenticatedRequestContext, policyId: string, versionId: string, body: UpdatePolicyVersionRequest): Promise<{ data: PolicyVersion }> {
    const orgId = this.orgId(ctx);
    const version = await this.repo.findVersion(orgId, policyId, versionId);
    if (!version) throw notFound('Versão não encontrada.');
    if (version.status !== 'DRAFT') throw alreadyPublished('Versão de política publicada é imutável.');
    assertRevision({ resourceType: 'policy_version', resourceId: version.id, expectedRevision: body.expectedRevision, currentRevision: version.revision });
    const data: Prisma.PolicyVersionUncheckedUpdateInput = { revision: { increment: 1 } };
    if (body.definition !== undefined) data.definition = policyDefinition.parse(body.definition) as unknown as Prisma.InputJsonValue;
    if (body.changeSummary !== undefined) data.changeSummary = body.changeSummary;
    const updated = await this.prisma.$transaction(async (tx) => {
      const res = await tx.policyVersion.updateMany({ where: { id: version.id, organizationId: orgId, status: 'DRAFT', revision: body.expectedRevision }, data });
      if (res.count === 0) {
        const fresh = await this.repo.findVersion(orgId, policyId, versionId, tx);
        if (fresh && fresh.status !== 'DRAFT') throw alreadyPublished('Versão publicada é imutável.');
        assertRevision({ resourceType: 'policy_version', resourceId: version.id, expectedRevision: body.expectedRevision, currentRevision: fresh?.revision ?? version.revision });
      }
      const fresh = (await this.repo.findVersion(orgId, policyId, versionId, tx))!;
      await this.audit.record(tx, { organizationId: orgId, actorUserId: ctx.userId, action: 'policy.version_updated', resourceType: 'policy_version', resourceId: version.id, correlationId: ctx.correlationId, metadata: {} });
      return fresh;
    });
    return { data: toPolicyVersionContract(updated) };
  }

  async publish(ctx: AuthenticatedRequestContext, policyId: string, versionId: string, body: PublishPolicyVersionRequest, key: string): Promise<{ statusCode: number; body: { data: PolicyVersion } }> {
    const orgId = this.orgId(ctx);
    const result = await runIdempotentCommand<{ data: PolicyVersion }, { policy: DbPolicy; version: DbPolicyVersion }>(
      { idem: this.idem, prisma: this.prisma },
      { method: 'POST', path: `/organizations/${orgId}/policies/${policyId}/versions/${versionId}/publish`, idempotencyKey: key, userId: ctx.userId, organizationId: orgId },
      body, 200,
      async (tx, { policy, version }) => {
        const res = await tx.policyVersion.updateMany({ where: { id: version.id, organizationId: orgId, policyId, status: 'DRAFT', revision: body.expectedRevision }, data: { status: 'PUBLISHED', publishedBy: ctx.userId, publishedAt: new Date(), changeSummary: body.changeSummary, revision: { increment: 1 } } });
        if (res.count === 0) {
          const fresh = await this.repo.findVersion(orgId, policyId, versionId, tx);
          if (fresh && fresh.status !== 'DRAFT') throw alreadyPublished('Versão já publicada.');
          assertRevision({ resourceType: 'policy_version', resourceId: version.id, expectedRevision: body.expectedRevision, currentRevision: fresh?.revision ?? version.revision });
        }
        if (policy.publishedVersionId && policy.publishedVersionId !== version.id) {
          await tx.policyVersion.updateMany({ where: { id: policy.publishedVersionId, organizationId: orgId, status: 'PUBLISHED' }, data: { status: 'SUPERSEDED', revision: { increment: 1 } } });
        }
        await tx.policy.updateMany({ where: { id: policyId, organizationId: orgId }, data: { publishedVersionId: version.id, currentDraftVersionId: null, status: 'PUBLISHED', revision: { increment: 1 } } });
        const published = (await this.repo.findVersion(orgId, policyId, versionId, tx))!;
        await this.audit.record(tx, { organizationId: orgId, actorUserId: ctx.userId, action: 'policy.published', resourceType: 'policy_version', resourceId: version.id, correlationId: ctx.correlationId, metadata: {} });
        return { data: toPolicyVersionContract(published) };
      },
      async () => {
        const policy = await this.loadPolicy(ctx, policyId);
        const version = await this.repo.findVersion(orgId, policyId, versionId);
        if (!version) throw notFound('Versão não encontrada.');
        if (version.status !== 'DRAFT') throw alreadyPublished('Versão já publicada é imutável.');
        // Definição precisa ser válida para publicar.
        policyDefinition.parse(version.definition);
        return { policy, version };
      },
    );
    return { statusCode: result.statusCode, body: result.response };
  }

  async transition(ctx: AuthenticatedRequestContext, policyId: string, body: PolicyTransitionRequest, key: string, target: 'SUSPENDED' | 'ARCHIVED', action: string): Promise<{ statusCode: number; body: { data: Policy } }> {
    const orgId = this.orgId(ctx);
    const result = await runIdempotentCommand<{ data: Policy }, DbPolicy>(
      { idem: this.idem, prisma: this.prisma },
      { method: 'POST', path: `/organizations/${orgId}/policies/${policyId}/${target.toLowerCase()}`, idempotencyKey: key, userId: ctx.userId, organizationId: orgId },
      body, 200,
      async (tx, policy) => {
        if (policy.status === target) return { data: toPolicyContract(policy) };
        if (target === 'SUSPENDED' && policy.status !== 'PUBLISHED') throw invalidStateTransition('Apenas política publicada pode ser suspensa.');
        assertRevision({ resourceType: 'policy', resourceId: policy.id, expectedRevision: body.expectedRevision, currentRevision: policy.revision });
        const res = await tx.policy.updateMany({ where: { id: policy.id, organizationId: orgId, revision: body.expectedRevision }, data: { status: target, revision: { increment: 1 } } });
        if (res.count === 0) assertRevision({ resourceType: 'policy', resourceId: policy.id, expectedRevision: body.expectedRevision, currentRevision: policy.revision + 1 });
        const fresh = (await this.repo.findPolicy(orgId, policy.id, tx))!;
        await this.auditPolicy(tx, ctx, action, policy.id, toPolicyContract(policy), toPolicyContract(fresh));
        return { data: toPolicyContract(fresh) };
      },
      () => this.loadPolicy(ctx, policyId),
    );
    return { statusCode: result.statusCode, body: result.response };
  }

  // ── Vínculos ─────────────────────────────────────────────────────────────────
  async listBindings(ctx: AuthenticatedRequestContext, operationId: string): Promise<{ data: OperationPolicyBinding[]; pagination: PaginationMeta }> {
    const rows = await this.repo.listBindings(this.orgId(ctx), operationId);
    return { data: rows.map(toBindingContract), pagination: { cursor: null, nextCursor: null, hasNextPage: false, limit: rows.length || 1 } };
  }

  async createBinding(ctx: AuthenticatedRequestContext, operationId: string, body: CreatePolicyBindingRequest, key: string): Promise<{ statusCode: number; body: { data: OperationPolicyBinding } }> {
    const orgId = this.orgId(ctx);
    const result = await runIdempotentCommand<{ data: OperationPolicyBinding }>(
      { idem: this.idem, prisma: this.prisma },
      { method: 'POST', path: `/organizations/${orgId}/operations/${operationId}/policy-bindings`, idempotencyKey: key, userId: ctx.userId, organizationId: orgId },
      body, 201,
      async (tx) => {
        const op = await tx.operation.findFirst({ where: { id: operationId, organizationId: orgId }, select: { id: true } });
        if (!op) throw notFound('Operação não encontrada.');
        const version = await tx.policyVersion.findFirst({ where: { id: body.policyVersionId, organizationId: orgId, policyId: body.policyId }, select: { id: true } });
        if (!version) throw notFound('Versão de política não encontrada.');
        const binding = await this.repo.createBinding(
          { organizationId: orgId, operationId, operationVersionId: body.operationVersionId ?? null, policyId: body.policyId, policyVersionId: body.policyVersionId, scope: body.scope, priority: body.priority, enabled: body.enabled, createdBy: ctx.userId },
          tx,
        );
        await this.audit.record(tx, { organizationId: orgId, actorUserId: ctx.userId, action: 'policy.bound_to_operation', resourceType: 'operation_policy_binding', resourceId: binding.id, correlationId: ctx.correlationId, metadata: { operationId, policyId: body.policyId } });
        return { data: toBindingContract(binding) };
      },
    );
    return { statusCode: result.statusCode, body: result.response };
  }

  async updateBinding(ctx: AuthenticatedRequestContext, operationId: string, bindingId: string, body: UpdatePolicyBindingRequest): Promise<{ data: OperationPolicyBinding }> {
    const orgId = this.orgId(ctx);
    const binding = await this.repo.findBinding(orgId, operationId, bindingId);
    if (!binding) throw notFound('Vínculo não encontrado.');
    assertRevision({ resourceType: 'operation_policy_binding', resourceId: binding.id, expectedRevision: body.expectedRevision, currentRevision: binding.revision });
    const data: Prisma.OperationPolicyBindingUncheckedUpdateInput = { revision: { increment: 1 } };
    if (body.priority !== undefined) data.priority = body.priority;
    if (body.enabled !== undefined) data.enabled = body.enabled;
    const updated = await this.prisma.$transaction(async (tx) => {
      const res = await tx.operationPolicyBinding.updateMany({ where: { id: binding.id, organizationId: orgId, revision: body.expectedRevision }, data });
      if (res.count === 0) assertRevision({ resourceType: 'operation_policy_binding', resourceId: binding.id, expectedRevision: body.expectedRevision, currentRevision: binding.revision + 1 });
      const fresh = (await this.repo.findBinding(orgId, operationId, bindingId, tx))!;
      await this.audit.record(tx, { organizationId: orgId, actorUserId: ctx.userId, action: 'policy.binding_updated', resourceType: 'operation_policy_binding', resourceId: binding.id, correlationId: ctx.correlationId, metadata: {} });
      return fresh;
    });
    return { data: toBindingContract(updated) };
  }

  async deleteBinding(ctx: AuthenticatedRequestContext, operationId: string, bindingId: string): Promise<{ data: OperationPolicyBinding }> {
    const orgId = this.orgId(ctx);
    const binding = await this.repo.findBinding(orgId, operationId, bindingId);
    if (!binding) throw notFound('Vínculo não encontrado.');
    const removed = await this.prisma.$transaction(async (tx) => {
      await tx.operationPolicyBinding.deleteMany({ where: { id: binding.id, organizationId: orgId } });
      await this.audit.record(tx, { organizationId: orgId, actorUserId: ctx.userId, action: 'policy.binding_removed', resourceType: 'operation_policy_binding', resourceId: binding.id, correlationId: ctx.correlationId, metadata: { operationId } });
      return binding;
    });
    return { data: toBindingContract(removed) };
  }
}
