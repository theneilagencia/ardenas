/**
 * Arden.AS API — solicitações e decisões de aprovação (ARDEN-BE-004).
 *
 * Núcleo do enforcement humano. A criação REAVALIA a ação no servidor (nunca
 * confia no cliente): só existe solicitação quando a decisão do servidor é
 * APPROVAL_REQUIRED. As decisões são imutáveis e obedecem a segregação de funções
 * (o solicitante não aprova a própria ação), elegibilidade por permissão/papel/
 * aprovador específico (com delegação), quórum por etapa e expiração. A transição
 * terminal usa TRAVA de linha (FOR UPDATE) para que votos concorrentes produzam
 * UMA única aprovação e UMA única autorização. A aprovação termina em uma
 * autorização persistida — não na execução da ação (execução é ARDEN-BE-005).
 */

import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { ApprovalRequest as DbRequest, ApprovalFlowStep as DbStep } from '@prisma/client';
import {
  type CreateApprovalRequestRequest,
  type DecideApprovalRequest,
  type CancelApprovalRequest,
  type ListApprovalRequestsQuery,
  type ApprovalRequest,
  type ApprovalDecisionResult,
  type PaginationMeta,
  type ActionKey,
} from '@arden/contracts';
import { PrismaService } from '../database/prisma.service';
import { IdempotencyService } from '../modules/idempotency/idempotency.service';
import { AuditRecorder } from '../audit/audit.recorder';
import { AuthorizationService } from '../authz/authorization.service';
import {
  notFound,
  resourceConflict,
  actionDenied,
  policyNotActive,
  approvalNotPending,
  approvalExpired,
  approvalInvalidated,
  approvalNotEligible,
  selfApprovalForbidden,
  approvalAlreadyDecided,
  validationError,
} from '../common/errors/api-error';
import { assertRevision } from '../common/concurrency/optimistic-concurrency';
import type { AuthenticatedRequestContext } from '../identity/request-context';
import { runIdempotentCommand } from '../operations/command.helpers';
import { ApprovalsRepository } from './approvals.repository';
import { toRequestContract } from './approval.serializers';
import { EnforcementService } from '../enforcement/enforcement.service';
import { toAuthorizationContract } from '../enforcement/enforcement.serializers';

@Injectable()
export class ApprovalRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repo: ApprovalsRepository,
    private readonly audit: AuditRecorder,
    private readonly idem: IdempotencyService,
    private readonly enforcement: EnforcementService,
    private readonly authz: AuthorizationService,
  ) {}

  private orgId(ctx: AuthenticatedRequestContext): string {
    return ctx.organizationId as string;
  }

  // ── Leitura ─────────────────────────────────────────────────────────────────
  async list(ctx: AuthenticatedRequestContext, query: ListApprovalRequestsQuery): Promise<{ data: ApprovalRequest[]; pagination: PaginationMeta }> {
    const rows = await this.repo.listRequests(
      this.orgId(ctx),
      { status: query.status, operationId: query.operationId, actionKey: query.actionKey },
      query.limit + 1,
      query.cursor,
    );
    const hasNextPage = rows.length > query.limit;
    const page = hasNextPage ? rows.slice(0, query.limit) : rows;
    const last = page[page.length - 1];
    return {
      data: page.map(toRequestContract),
      pagination: { cursor: query.cursor ?? null, nextCursor: hasNextPage && last ? last.requestedAt.toISOString() : null, hasNextPage, limit: query.limit },
    };
  }

  private async load(ctx: AuthenticatedRequestContext, id: string, tx?: Prisma.TransactionClient): Promise<DbRequest> {
    const req = await this.repo.findRequest(this.orgId(ctx), id, tx);
    if (!req) throw notFound('Solicitação não encontrada.');
    return req;
  }

  async get(ctx: AuthenticatedRequestContext, id: string): Promise<{ data: ApprovalRequest }> {
    return { data: toRequestContract(await this.load(ctx, id)) };
  }

  // ── Criação ───────────────────────────────────────────────────────────────────
  async create(
    ctx: AuthenticatedRequestContext,
    operationId: string,
    body: CreateApprovalRequestRequest,
    key: string,
  ): Promise<{ statusCode: number; body: { data: ApprovalRequest } }> {
    const orgId = this.orgId(ctx);
    const result = await runIdempotentCommand<{ data: ApprovalRequest }>(
      { idem: this.idem, prisma: this.prisma },
      { method: 'POST', path: `/organizations/${orgId}/operations/${operationId}/approval-requests`, idempotencyKey: key, userId: ctx.userId, organizationId: orgId },
      body, 201,
      async (tx) => {
        const now = new Date();
        const core = await this.enforcement.evaluateCore(ctx, operationId, body.actionKey as ActionKey, body.actionPayload, now, tx);
        if (core.decision === 'ALLOWED') throw resourceConflict('Ação permitida diretamente; solicitação de aprovação desnecessária.');
        if (core.decision === 'DENIED') throw actionDenied('Ação bloqueada pela avaliação de autoridade.', { reasonCodes: core.reasonCodes });

        const flowId = core.approvalFlowId;
        if (!flowId) throw policyNotActive('Nenhum fluxo de aprovação aplicável à ação.');
        const flow = await this.repo.findFlow(orgId, flowId, tx);
        if (!flow) throw policyNotActive('Fluxo de aprovação não encontrado.');
        if (flow.status !== 'ACTIVE') throw policyNotActive('Fluxo de aprovação não está ativo.');

        const firstStep = [...flow.steps].sort((a, b) => a.sequence - b.sequence)[0];
        const expiresAt = firstStep?.expiresAfterMinutes ? new Date(now.getTime() + firstStep.expiresAfterMinutes * 60_000) : null;

        const request = await tx.approvalRequest.create({
          data: {
            organizationId: orgId,
            operationId,
            operationVersionId: core.operationVersionId,
            actionKey: body.actionKey,
            actionPayloadHash: core.actionPayloadHash,
            actionContext: core.actionContext as Prisma.InputJsonValue,
            requestedBy: ctx.userId,
            approvalFlowId: flowId,
            currentStepSequence: firstStep?.sequence ?? 1,
            status: 'PENDING',
            expiresAt,
            policySnapshot: core.policySnapshot as Prisma.InputJsonValue,
            authoritySnapshot: core.authorityProfile as unknown as Prisma.InputJsonValue,
            correlationId: ctx.correlationId,
          },
        });
        await this.audit.record(tx, { organizationId: orgId, actorUserId: ctx.userId, action: 'approval_request.created', resourceType: 'approval_request', resourceId: request.id, correlationId: ctx.correlationId, after: toRequestContract(request), metadata: { operationId, actionKey: body.actionKey, reasonCodes: core.reasonCodes } });
        return { data: toRequestContract(request) };
      },
    );
    return { statusCode: result.statusCode, body: result.response };
  }

  // ── Elegibilidade e segregação ──────────────────────────────────────────────
  private stepSatisfiedBy(step: DbStep, identity: string, roles: string[], perms: ReadonlySet<string>): boolean {
    if (step.specificApproverUserId && identity !== step.specificApproverUserId) return false;
    if (step.eligibleRoleKey && !roles.includes(step.eligibleRoleKey)) return false;
    if (step.requiredPermission && !perms.has(step.requiredPermission)) return false;
    return true;
  }

  private async assertEligible(ctx: AuthenticatedRequestContext, orgId: string, step: DbStep, request: DbRequest, now: Date): Promise<string> {
    // Segregação de funções: o solicitante não aprova a própria ação.
    if (step.requesterCannotApprove && ctx.userId === request.requestedBy) {
      throw selfApprovalForbidden();
    }
    // Identidades efetivas: o próprio ator + quem ele representa por delegação ATIVA.
    const delegations = await this.repo.activeDelegationsFor(orgId, ctx.userId, now);
    const represented = delegations.map((d) => d.delegatorUserId);

    // 1) O ator, com suas próprias permissões.
    const actorRoles = await this.repo.roleKeysFor(orgId, ctx.userId);
    if (this.stepSatisfiedBy(step, ctx.userId, actorRoles, ctx.permissions)) return ctx.userId;

    // 2) Cada delegante representado, com permissões efetivas dele.
    for (const delegatorId of represented) {
      const roles = await this.repo.roleKeysFor(orgId, delegatorId);
      const perms = await this.authz.getEffectivePermissions(delegatorId, orgId);
      if (this.stepSatisfiedBy(step, delegatorId, roles, perms)) return delegatorId;
    }
    throw approvalNotEligible();
  }

  private currentStep(steps: DbStep[], sequence: number): DbStep {
    const step = steps.find((s) => s.sequence === sequence);
    if (!step) throw resourceConflict('Etapa corrente do fluxo não encontrada.');
    return step;
  }

  /** Expira preguiçosamente uma solicitação pendente vencida. */
  private async lazyExpire(orgId: string, request: DbRequest, ctx: AuthenticatedRequestContext, now: Date): Promise<DbRequest> {
    if (request.status === 'PENDING' && request.expiresAt && request.expiresAt < now) {
      return this.prisma.$transaction(async (tx) => {
        await tx.approvalRequest.updateMany({ where: { id: request.id, organizationId: orgId, status: 'PENDING' }, data: { status: 'EXPIRED', decidedAt: now, revision: { increment: 1 } } });
        const fresh = (await this.repo.findRequest(orgId, request.id, tx))!;
        await this.audit.record(tx, { organizationId: orgId, actorUserId: ctx.userId, action: 'approval_request.expired', resourceType: 'approval_request', resourceId: request.id, correlationId: ctx.correlationId, before: toRequestContract(request), after: toRequestContract(fresh), metadata: {} });
        return fresh;
      });
    }
    return request;
  }

  private assertPending(request: DbRequest): void {
    if (request.status === 'PENDING') return;
    if (request.status === 'EXPIRED') throw approvalExpired();
    if (request.status === 'INVALIDATED') throw approvalInvalidated();
    throw approvalNotPending(`Solicitação está ${request.status}.`);
  }

  // ── Decisão: aprovar ────────────────────────────────────────────────────────
  async approve(ctx: AuthenticatedRequestContext, id: string, body: DecideApprovalRequest): Promise<{ data: ApprovalDecisionResult }> {
    const orgId = this.orgId(ctx);
    const now = new Date();
    let request = await this.load(ctx, id);
    request = await this.lazyExpire(orgId, request, ctx, now);
    this.assertPending(request);
    assertRevision({ resourceType: 'approval_request', resourceId: request.id, expectedRevision: body.expectedRevision, currentRevision: request.revision });

    const flow = await this.repo.findFlow(orgId, request.approvalFlowId);
    if (!flow) throw policyNotActive('Fluxo da solicitação não encontrado.');
    const step = this.currentStep(flow.steps, request.currentStepSequence);

    const actingAs = await this.assertEligible(ctx, orgId, step, request, now);
    if (step.justificationRequired && !body.justification) {
      throw validationError([{ field: 'justification', code: 'required', message: 'Justificativa é obrigatória nesta etapa.' }]);
    }

    const outcome = await this.prisma.$transaction(async (tx) => {
      // Trava a linha para serializar votos concorrentes desta solicitação.
      await tx.$executeRaw`SELECT 1 FROM approval_requests WHERE id = ${id}::uuid FOR UPDATE`;
      const locked = (await this.repo.findRequest(orgId, id, tx))!;
      if (locked.status !== 'PENDING') throw approvalNotPending(`Solicitação está ${locked.status}.`);
      if (locked.currentStepSequence !== step.sequence) throw approvalNotPending('Etapa avançou; recarregue a solicitação.');

      // Decisão imutável e única por (solicitação, etapa, aprovador).
      const existing = await tx.approvalDecision.findFirst({ where: { approvalRequestId: id, approvalFlowStepId: step.id, decidedBy: ctx.userId } });
      if (existing) throw approvalAlreadyDecided();
      await tx.approvalDecision.create({
        data: { organizationId: orgId, approvalRequestId: id, approvalFlowStepId: step.id, decidedBy: ctx.userId, decision: 'APPROVE', justification: body.justification ?? null, correlationId: ctx.correlationId },
      });

      const approvals = await tx.approvalDecision.count({ where: { approvalRequestId: id, approvalFlowStepId: step.id, decision: 'APPROVE' } });
      const required = step.decisionMode === 'ANY_ONE' ? 1 : (step.quorum ?? 1);

      let issuedAuth: Awaited<ReturnType<EnforcementService['issueAuthorization']>> | null = null;
      if (approvals >= required) {
        const remaining = [...flow.steps].filter((s) => s.sequence > step.sequence).sort((a, b) => a.sequence - b.sequence);
        if (remaining.length === 0) {
          // Última etapa concluída → APROVADA + emite UMA autorização.
          await tx.approvalRequest.updateMany({ where: { id, organizationId: orgId, status: 'PENDING' }, data: { status: 'APPROVED', decidedAt: now, revision: { increment: 1 } } });
          const auth = await this.enforcement.issueAuthorization(tx, {
            organizationId: orgId, approvalRequestId: id, operationId: locked.operationId, operationVersionId: locked.operationVersionId,
            actionKey: locked.actionKey, actionPayloadHash: locked.actionPayloadHash, grantedToUserId: locked.requestedBy,
            validUntil: null, authoritySnapshot: locked.authoritySnapshot, policySnapshot: locked.policySnapshot, correlationId: ctx.correlationId,
          });
          issuedAuth = auth;
          await this.audit.record(tx, { organizationId: orgId, actorUserId: ctx.userId, action: 'approval_request.approved', resourceType: 'approval_request', resourceId: id, correlationId: ctx.correlationId, metadata: { actingAs, stepSequence: step.sequence } });
          await this.audit.record(tx, { organizationId: orgId, actorUserId: ctx.userId, action: 'action_authorization.granted', resourceType: 'action_authorization', resourceId: auth.id, correlationId: ctx.correlationId, metadata: { approvalRequestId: id } });
        } else {
          // Avança para a próxima etapa (recalcula expiração).
          const next = remaining[0];
          const nextExpires = next.expiresAfterMinutes ? new Date(now.getTime() + next.expiresAfterMinutes * 60_000) : null;
          await tx.approvalRequest.updateMany({ where: { id, organizationId: orgId, status: 'PENDING', currentStepSequence: step.sequence }, data: { currentStepSequence: next.sequence, expiresAt: nextExpires, revision: { increment: 1 } } });
          await this.audit.record(tx, { organizationId: orgId, actorUserId: ctx.userId, action: 'approval_request.step_advanced', resourceType: 'approval_request', resourceId: id, correlationId: ctx.correlationId, metadata: { actingAs, from: step.sequence, to: next.sequence } });
        }
      } else {
        await this.audit.record(tx, { organizationId: orgId, actorUserId: ctx.userId, action: 'approval_request.vote_recorded', resourceType: 'approval_request', resourceId: id, correlationId: ctx.correlationId, metadata: { actingAs, stepSequence: step.sequence, approvals, required } });
      }

      const fresh = (await this.repo.findRequest(orgId, id, tx))!;
      return { request: fresh, authorization: issuedAuth };
    });

    return {
      data: {
        request: toRequestContract(outcome.request),
        authorization: outcome.authorization ? toAuthorizationContract(outcome.authorization) : null,
      },
    };
  }

  // ── Decisão: rejeitar ─────────────────────────────────────────────────────────
  async reject(ctx: AuthenticatedRequestContext, id: string, body: DecideApprovalRequest): Promise<{ data: ApprovalRequest }> {
    const orgId = this.orgId(ctx);
    const now = new Date();
    let request = await this.load(ctx, id);
    request = await this.lazyExpire(orgId, request, ctx, now);
    this.assertPending(request);
    assertRevision({ resourceType: 'approval_request', resourceId: request.id, expectedRevision: body.expectedRevision, currentRevision: request.revision });

    const flow = await this.repo.findFlow(orgId, request.approvalFlowId);
    if (!flow) throw policyNotActive('Fluxo da solicitação não encontrado.');
    const step = this.currentStep(flow.steps, request.currentStepSequence);
    const actingAs = await this.assertEligible(ctx, orgId, step, request, now);
    if (step.justificationRequired && !body.justification) {
      throw validationError([{ field: 'justification', code: 'required', message: 'Justificativa é obrigatória nesta etapa.' }]);
    }

    const fresh = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT 1 FROM approval_requests WHERE id = ${id}::uuid FOR UPDATE`;
      const locked = (await this.repo.findRequest(orgId, id, tx))!;
      if (locked.status !== 'PENDING') throw approvalNotPending(`Solicitação está ${locked.status}.`);
      const existing = await tx.approvalDecision.findFirst({ where: { approvalRequestId: id, approvalFlowStepId: step.id, decidedBy: ctx.userId } });
      if (existing) throw approvalAlreadyDecided();
      await tx.approvalDecision.create({
        data: { organizationId: orgId, approvalRequestId: id, approvalFlowStepId: step.id, decidedBy: ctx.userId, decision: 'REJECT', justification: body.justification ?? null, correlationId: ctx.correlationId },
      });
      // Uma rejeição encerra a solicitação.
      await tx.approvalRequest.updateMany({ where: { id, organizationId: orgId, status: 'PENDING' }, data: { status: 'REJECTED', decidedAt: now, revision: { increment: 1 } } });
      const updated = (await this.repo.findRequest(orgId, id, tx))!;
      await this.audit.record(tx, { organizationId: orgId, actorUserId: ctx.userId, action: 'approval_request.rejected', resourceType: 'approval_request', resourceId: id, correlationId: ctx.correlationId, before: toRequestContract(locked), after: toRequestContract(updated), metadata: { actingAs, stepSequence: step.sequence } });
      return updated;
    });
    return { data: toRequestContract(fresh) };
  }

  // ── Cancelamento (pelo solicitante ou quem tem approval.cancel) ────────────────
  async cancel(ctx: AuthenticatedRequestContext, id: string, body: CancelApprovalRequest): Promise<{ data: ApprovalRequest }> {
    const orgId = this.orgId(ctx);
    const now = new Date();
    let request = await this.load(ctx, id);
    request = await this.lazyExpire(orgId, request, ctx, now);
    this.assertPending(request);
    assertRevision({ resourceType: 'approval_request', resourceId: request.id, expectedRevision: body.expectedRevision, currentRevision: request.revision });

    const fresh = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT 1 FROM approval_requests WHERE id = ${id}::uuid FOR UPDATE`;
      const locked = (await this.repo.findRequest(orgId, id, tx))!;
      if (locked.status !== 'PENDING') throw approvalNotPending(`Solicitação está ${locked.status}.`);
      await tx.approvalRequest.updateMany({ where: { id, organizationId: orgId, status: 'PENDING' }, data: { status: 'CANCELLED', decidedAt: now, revision: { increment: 1 } } });
      const updated = (await this.repo.findRequest(orgId, id, tx))!;
      await this.audit.record(tx, { organizationId: orgId, actorUserId: ctx.userId, action: 'approval_request.cancelled', resourceType: 'approval_request', resourceId: id, correlationId: ctx.correlationId, before: toRequestContract(locked), after: toRequestContract(updated), metadata: { reason: body.reason ?? null } });
      return updated;
    });
    return { data: toRequestContract(fresh) };
  }
}
