/**
 * Arden.AS API — serviço de fluxos de aprovação (ARDEN-BE-004).
 *
 * Um fluxo é uma sequência ordenada de etapas; cada etapa define modo de decisão,
 * elegibilidade, segregação de funções, justificativa, prazo e escalonamento.
 * Criação/edição transacional; edição substitui as etapas em bloco (concorrência
 * otimista). Ativação/suspensão controla se o fluxo pode governar novas ações.
 */

import { Injectable } from '@nestjs/common';
import type { Prisma, ApprovalFlow as DbFlow, ApprovalFlowStep as DbStep } from '@prisma/client';
import {
  type CreateApprovalFlowRequest,
  type UpdateApprovalFlowRequest,
  type ApprovalFlowTransitionRequest,
  type ApprovalFlow,
  type ApprovalFlowStepInput,
  type PaginationMeta,
} from '@arden/contracts';
import { PrismaService } from '../database/prisma.service';
import { IdempotencyService } from '../modules/idempotency/idempotency.service';
import { AuditRecorder } from '../audit/audit.recorder';
import { notFound, resourceConflict, invalidStateTransition, validationError } from '../common/errors/api-error';
import { assertRevision } from '../common/concurrency/optimistic-concurrency';
import type { AuthenticatedRequestContext } from '../identity/request-context';
import { runIdempotentCommand } from '../operations/command.helpers';
import { ApprovalsRepository } from './approvals.repository';
import { toFlowContract } from './approval.serializers';

type FlowWithSteps = DbFlow & { steps: DbStep[] };

@Injectable()
export class ApprovalFlowsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repo: ApprovalsRepository,
    private readonly audit: AuditRecorder,
    private readonly idem: IdempotencyService,
  ) {}

  private orgId(ctx: AuthenticatedRequestContext): string {
    return ctx.organizationId as string;
  }

  /** Etapas devem ter sequências únicas e contíguas a partir de 1. */
  private assertSequences(steps: ApprovalFlowStepInput[]): void {
    const seqs = steps.map((s) => s.sequence).sort((a, b) => a - b);
    for (let i = 0; i < seqs.length; i++) {
      if (seqs[i] !== i + 1) {
        throw validationError([{ field: 'steps', code: 'invalid_sequence', message: 'Sequências das etapas devem ser 1..N sem lacunas nem repetições.' }]);
      }
    }
    for (const s of steps) {
      if (s.decisionMode === 'QUORUM' && (s.quorum ?? 0) < 1) {
        throw validationError([{ field: 'steps', code: 'invalid_quorum', message: 'Etapa QUORUM exige quorum >= 1.' }]);
      }
    }
  }

  private stepData(orgId: string, flowId: string, s: ApprovalFlowStepInput) {
    return {
      organizationId: orgId,
      approvalFlowId: flowId,
      sequence: s.sequence,
      name: s.name,
      decisionMode: s.decisionMode,
      quorum: s.decisionMode === 'ANY_ONE' ? null : (s.quorum ?? null),
      requiredPermission: s.requiredPermission ?? null,
      eligibleRoleKey: s.eligibleRoleKey ?? null,
      specificApproverUserId: s.specificApproverUserId ?? null,
      requesterCannotApprove: s.requesterCannotApprove,
      justificationRequired: s.justificationRequired,
      expiresAfterMinutes: s.expiresAfterMinutes ?? null,
      escalationAfterMinutes: s.escalationAfterMinutes ?? null,
    };
  }

  async list(ctx: AuthenticatedRequestContext, limit: number, cursor?: string): Promise<{ data: ApprovalFlow[]; pagination: PaginationMeta }> {
    const rows = await this.repo.listFlows(this.orgId(ctx), limit + 1, cursor);
    const hasNextPage = rows.length > limit;
    const page = hasNextPage ? rows.slice(0, limit) : rows;
    const last = page[page.length - 1];
    return {
      data: page.map(toFlowContract),
      pagination: { cursor: cursor ?? null, nextCursor: hasNextPage && last ? last.createdAt.toISOString() : null, hasNextPage, limit },
    };
  }

  private async load(ctx: AuthenticatedRequestContext, id: string): Promise<FlowWithSteps> {
    const flow = await this.repo.findFlow(this.orgId(ctx), id);
    if (!flow) throw notFound('Fluxo de aprovação não encontrado.');
    return flow;
  }

  async get(ctx: AuthenticatedRequestContext, id: string): Promise<{ data: ApprovalFlow }> {
    return { data: toFlowContract(await this.load(ctx, id)) };
  }

  async create(ctx: AuthenticatedRequestContext, body: CreateApprovalFlowRequest, key: string): Promise<{ statusCode: number; body: { data: ApprovalFlow } }> {
    const orgId = this.orgId(ctx);
    this.assertSequences(body.steps);
    const result = await runIdempotentCommand<{ data: ApprovalFlow }>(
      { idem: this.idem, prisma: this.prisma },
      { method: 'POST', path: `/organizations/${orgId}/approval-flows`, idempotencyKey: key, userId: ctx.userId, organizationId: orgId },
      body, 201,
      async (tx) => {
        if (await tx.approvalFlow.findFirst({ where: { organizationId: orgId, key: body.key }, select: { id: true } })) {
          throw resourceConflict('Já existe um fluxo com esta chave.');
        }
        const flow = await tx.approvalFlow.create({
          data: { organizationId: orgId, key: body.key, name: body.name, description: body.description ?? null, status: 'DRAFT', createdBy: ctx.userId },
        });
        for (const s of body.steps) {
          await tx.approvalFlowStep.create({ data: this.stepData(orgId, flow.id, s) });
        }
        const fresh = (await this.repo.findFlow(orgId, flow.id, tx))!;
        await this.audit.record(tx, { organizationId: orgId, actorUserId: ctx.userId, action: 'approval_flow.created', resourceType: 'approval_flow', resourceId: flow.id, correlationId: ctx.correlationId, after: toFlowContract(fresh), metadata: {} });
        return { data: toFlowContract(fresh) };
      },
    );
    return { statusCode: result.statusCode, body: result.response };
  }

  async update(ctx: AuthenticatedRequestContext, id: string, body: UpdateApprovalFlowRequest): Promise<{ data: ApprovalFlow }> {
    const orgId = this.orgId(ctx);
    const flow = await this.load(ctx, id);
    if (flow.status === 'ARCHIVED') throw invalidStateTransition('Fluxo arquivado não pode ser editado.');
    if (body.steps) this.assertSequences(body.steps);
    assertRevision({ resourceType: 'approval_flow', resourceId: flow.id, expectedRevision: body.expectedRevision, currentRevision: flow.revision });
    const updated = await this.prisma.$transaction(async (tx) => {
      const data: Prisma.ApprovalFlowUncheckedUpdateInput = { revision: { increment: 1 } };
      if (body.name !== undefined) data.name = body.name;
      if (body.description !== undefined) data.description = body.description;
      const res = await tx.approvalFlow.updateMany({ where: { id: flow.id, organizationId: orgId, revision: body.expectedRevision }, data });
      if (res.count === 0) assertRevision({ resourceType: 'approval_flow', resourceId: flow.id, expectedRevision: body.expectedRevision, currentRevision: flow.revision + 1 });
      if (body.steps) {
        await tx.approvalFlowStep.deleteMany({ where: { approvalFlowId: flow.id, organizationId: orgId } });
        for (const s of body.steps) await tx.approvalFlowStep.create({ data: this.stepData(orgId, flow.id, s) });
      }
      const fresh = (await this.repo.findFlow(orgId, flow.id, tx))!;
      await this.audit.record(tx, { organizationId: orgId, actorUserId: ctx.userId, action: 'approval_flow.updated', resourceType: 'approval_flow', resourceId: flow.id, correlationId: ctx.correlationId, before: toFlowContract(flow), after: toFlowContract(fresh), metadata: {} });
      return fresh;
    });
    return { data: toFlowContract(updated) };
  }

  async transition(
    ctx: AuthenticatedRequestContext,
    id: string,
    body: ApprovalFlowTransitionRequest,
    key: string,
    target: 'ACTIVE' | 'SUSPENDED',
    action: string,
  ): Promise<{ statusCode: number; body: { data: ApprovalFlow } }> {
    const orgId = this.orgId(ctx);
    const result = await runIdempotentCommand<{ data: ApprovalFlow }, FlowWithSteps>(
      { idem: this.idem, prisma: this.prisma },
      { method: 'POST', path: `/organizations/${orgId}/approval-flows/${id}/${target.toLowerCase()}`, idempotencyKey: key, userId: ctx.userId, organizationId: orgId },
      body, 200,
      async (tx, flow) => {
        if (flow.status === target) return { data: toFlowContract(flow) };
        if (target === 'ACTIVE' && flow.steps.length === 0) throw invalidStateTransition('Fluxo sem etapas não pode ser ativado.');
        if (flow.status === 'ARCHIVED') throw invalidStateTransition('Fluxo arquivado não pode transicionar.');
        assertRevision({ resourceType: 'approval_flow', resourceId: flow.id, expectedRevision: body.expectedRevision, currentRevision: flow.revision });
        const res = await tx.approvalFlow.updateMany({ where: { id: flow.id, organizationId: orgId, revision: body.expectedRevision }, data: { status: target, revision: { increment: 1 } } });
        if (res.count === 0) assertRevision({ resourceType: 'approval_flow', resourceId: flow.id, expectedRevision: body.expectedRevision, currentRevision: flow.revision + 1 });
        const fresh = (await this.repo.findFlow(orgId, flow.id, tx))!;
        await this.audit.record(tx, { organizationId: orgId, actorUserId: ctx.userId, action, resourceType: 'approval_flow', resourceId: flow.id, correlationId: ctx.correlationId, before: toFlowContract(flow), after: toFlowContract(fresh), metadata: {} });
        return { data: toFlowContract(fresh) };
      },
      () => this.load(ctx, id),
    );
    return { statusCode: result.statusCode, body: result.response };
  }
}
