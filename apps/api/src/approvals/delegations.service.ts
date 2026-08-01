/**
 * Arden.AS API — serviço de delegações de aprovação (ARDEN-BE-004).
 *
 * Um aprovador delega TEMPORARIAMENTE sua elegibilidade a outro usuário, dentro
 * de uma janela. A delegação NÃO cria autoridade nova: o delegado só pode o que o
 * delegante poderia. Proibições: auto-delegação e ciclos (A→B enquanto B→…→A).
 * Segregação de funções permanece: o delegado ainda não pode aprovar uma ação que
 * ele mesmo solicitou.
 */

import { Injectable } from '@nestjs/common';
import type { ApprovalDelegation as DbDelegation } from '@prisma/client';
import {
  type CreateApprovalDelegationRequest,
  type RevokeApprovalDelegationRequest,
  type ApprovalDelegation,
} from '@arden/contracts';
import { PrismaService } from '../database/prisma.service';
import { IdempotencyService } from '../modules/idempotency/idempotency.service';
import { AuditRecorder } from '../audit/audit.recorder';
import { notFound, resourceConflict, validationError, invalidStateTransition } from '../common/errors/api-error';
import type { AuthenticatedRequestContext } from '../identity/request-context';
import { runIdempotentCommand } from '../operations/command.helpers';
import { ApprovalsRepository } from './approvals.repository';
import { toDelegationContract } from './approval.serializers';

@Injectable()
export class ApprovalDelegationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repo: ApprovalsRepository,
    private readonly audit: AuditRecorder,
    private readonly idem: IdempotencyService,
  ) {}

  private orgId(ctx: AuthenticatedRequestContext): string {
    return ctx.organizationId as string;
  }

  async list(ctx: AuthenticatedRequestContext): Promise<{ data: ApprovalDelegation[] }> {
    const rows = await this.repo.listDelegations(this.orgId(ctx));
    return { data: rows.map(toDelegationContract) };
  }

  /** BFS pela grade de delegações ATIVAS: `to` alcança `from`? (evita ciclos) */
  private async createsCycle(orgId: string, from: string, to: string): Promise<boolean> {
    const all = await this.prisma.approvalDelegation.findMany({
      where: { organizationId: orgId, status: 'ACTIVE' },
      select: { delegatorUserId: true, delegateUserId: true },
    });
    const adjacency = new Map<string, string[]>();
    for (const d of all) {
      const list = adjacency.get(d.delegatorUserId) ?? [];
      list.push(d.delegateUserId);
      adjacency.set(d.delegatorUserId, list);
    }
    // Nova aresta from→to; ciclo se `to` já alcança `from`.
    const seen = new Set<string>();
    const queue = [to];
    while (queue.length) {
      const node = queue.shift()!;
      if (node === from) return true;
      if (seen.has(node)) continue;
      seen.add(node);
      for (const next of adjacency.get(node) ?? []) queue.push(next);
    }
    return false;
  }

  async create(ctx: AuthenticatedRequestContext, body: CreateApprovalDelegationRequest, key: string): Promise<{ statusCode: number; body: { data: ApprovalDelegation } }> {
    const orgId = this.orgId(ctx);
    const delegator = ctx.userId;
    if (body.delegateUserId === delegator) {
      throw validationError([{ field: 'delegateUserId', code: 'self_delegation', message: 'Não é possível delegar para si mesmo.' }]);
    }
    if (new Date(body.validUntil) <= new Date(body.validFrom)) {
      throw validationError([{ field: 'validUntil', code: 'invalid_window', message: 'validUntil deve ser posterior a validFrom.' }]);
    }
    if (await this.createsCycle(orgId, delegator, body.delegateUserId)) {
      throw resourceConflict('Delegação criaria um ciclo.');
    }
    const result = await runIdempotentCommand<{ data: ApprovalDelegation }>(
      { idem: this.idem, prisma: this.prisma },
      { method: 'POST', path: `/organizations/${orgId}/approval-delegations`, idempotencyKey: key, userId: ctx.userId, organizationId: orgId },
      body, 201,
      async (tx) => {
        // O delegado precisa ser um membro ativo da organização.
        const membership = await tx.membership.findFirst({ where: { organizationId: orgId, userId: body.delegateUserId, status: 'ACTIVE' }, select: { id: true } });
        if (!membership) throw notFound('Usuário delegado não é membro ativo.');
        const delegation = await tx.approvalDelegation.create({
          data: {
            organizationId: orgId,
            delegatorUserId: delegator,
            delegateUserId: body.delegateUserId,
            validFrom: new Date(body.validFrom),
            validUntil: new Date(body.validUntil),
            scope: (body.scope ?? {}) as never,
            status: 'ACTIVE',
            createdBy: ctx.userId,
          },
        });
        await this.audit.record(tx, { organizationId: orgId, actorUserId: ctx.userId, action: 'approval_delegation.created', resourceType: 'approval_delegation', resourceId: delegation.id, correlationId: ctx.correlationId, after: toDelegationContract(delegation), metadata: { delegateUserId: body.delegateUserId } });
        return { data: toDelegationContract(delegation) };
      },
    );
    return { statusCode: result.statusCode, body: result.response };
  }

  async revoke(ctx: AuthenticatedRequestContext, id: string, body: RevokeApprovalDelegationRequest, key: string): Promise<{ statusCode: number; body: { data: ApprovalDelegation } }> {
    const orgId = this.orgId(ctx);
    const result = await runIdempotentCommand<{ data: ApprovalDelegation }, DbDelegation>(
      { idem: this.idem, prisma: this.prisma },
      { method: 'POST', path: `/organizations/${orgId}/approval-delegations/${id}/revoke`, idempotencyKey: key, userId: ctx.userId, organizationId: orgId },
      body, 200,
      async (tx, delegation) => {
        if (delegation.status === 'REVOKED') return { data: toDelegationContract(delegation) };
        if (delegation.status !== 'ACTIVE') throw invalidStateTransition('Apenas delegação ativa pode ser revogada.');
        await tx.approvalDelegation.updateMany({ where: { id: delegation.id, organizationId: orgId, status: 'ACTIVE' }, data: { status: 'REVOKED', revokedAt: new Date() } });
        const fresh = (await this.repo.findDelegation(orgId, delegation.id, tx))!;
        await this.audit.record(tx, { organizationId: orgId, actorUserId: ctx.userId, action: 'approval_delegation.revoked', resourceType: 'approval_delegation', resourceId: delegation.id, correlationId: ctx.correlationId, before: toDelegationContract(delegation), after: toDelegationContract(fresh), metadata: { reason: body.reason ?? null } });
        return { data: toDelegationContract(fresh) };
      },
      async () => {
        const delegation = await this.repo.findDelegation(orgId, id);
        if (!delegation) throw notFound('Delegação não encontrada.');
        return delegation;
      },
    );
    return { statusCode: result.statusCode, body: result.response };
  }
}
