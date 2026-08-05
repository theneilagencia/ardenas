/**
 * Arden.AS API — acesso a dados de aprovações (ARDEN-BE-004).
 * Toda consulta é escopada por organização (tenant no path nunca autoriza,
 * mas SEMPRE filtra). Aceita cliente de transação opcional.
 */

import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

type Db = Prisma.TransactionClient | PrismaService;

@Injectable()
export class ApprovalsRepository {
  constructor(private readonly prisma: PrismaService) {}

  private db(tx?: Prisma.TransactionClient): Db {
    return tx ?? this.prisma;
  }

  // ── Papéis do ator (para elegibilidade) ────────────────────────────────────
  async roleKeysFor(organizationId: string, userId: string, tx?: Prisma.TransactionClient): Promise<string[]> {
    const membership = await this.db(tx).membership.findFirst({
      where: { organizationId, userId, status: 'ACTIVE' },
      select: { roles: { select: { role: { select: { key: true } } } } },
    });
    return membership?.roles.map((r) => r.role.key) ?? [];
  }

  // ── Fluxos ──────────────────────────────────────────────────────────────────
  listFlows(organizationId: string, limit: number, cursor?: string, tx?: Prisma.TransactionClient) {
    return this.db(tx).approvalFlow.findMany({
      where: { organizationId, ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}) },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { steps: true },
    });
  }

  findFlow(organizationId: string, id: string, tx?: Prisma.TransactionClient) {
    return this.db(tx).approvalFlow.findFirst({ where: { id, organizationId }, include: { steps: true } });
  }

  findFlowByKey(organizationId: string, key: string, tx?: Prisma.TransactionClient) {
    return this.db(tx).approvalFlow.findFirst({ where: { organizationId, key }, include: { steps: true } });
  }

  // ── Solicitações ──────────────────────────────────────────────────────────────
  findRequest(organizationId: string, id: string, tx?: Prisma.TransactionClient) {
    return this.db(tx).approvalRequest.findFirst({ where: { id, organizationId } });
  }

  listRequests(
    organizationId: string,
    filters: { status?: string; operationId?: string; actionKey?: string },
    limit: number,
    cursor?: string,
    tx?: Prisma.TransactionClient,
  ) {
    return this.db(tx).approvalRequest.findMany({
      where: {
        organizationId,
        ...(filters.status ? { status: filters.status as never } : {}),
        ...(filters.operationId ? { operationId: filters.operationId } : {}),
        ...(filters.actionKey ? { actionKey: filters.actionKey } : {}),
        ...(cursor ? { requestedAt: { lt: new Date(cursor) } } : {}),
      },
      orderBy: { requestedAt: 'desc' },
      take: limit,
    });
  }

  decisionsForStep(approvalRequestId: string, approvalFlowStepId: string, tx?: Prisma.TransactionClient) {
    return this.db(tx).approvalDecision.findMany({ where: { approvalRequestId, approvalFlowStepId } });
  }

  // ── Delegações ────────────────────────────────────────────────────────────────
  findDelegation(organizationId: string, id: string, tx?: Prisma.TransactionClient) {
    return this.db(tx).approvalDelegation.findFirst({ where: { id, organizationId } });
  }

  listDelegations(organizationId: string, tx?: Prisma.TransactionClient) {
    return this.db(tx).approvalDelegation.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Delegações ATIVAS em que `delegateUserId` age por outrem, dentro da janela. */
  activeDelegationsFor(organizationId: string, delegateUserId: string, now: Date, tx?: Prisma.TransactionClient) {
    return this.db(tx).approvalDelegation.findMany({
      where: {
        organizationId,
        delegateUserId,
        status: 'ACTIVE',
        validFrom: { lte: now },
        validUntil: { gte: now },
      },
    });
  }
}
