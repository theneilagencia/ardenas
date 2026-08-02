/**
 * Arden.AS API — repositórios de tool bindings (ARDEN-BE-006.3).
 * TENANT-SCOPED. Operation binding usa remoção LÓGICA (removedAt) — nunca delete
 * físico (§18). Updates guardados por revision.
 */

import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

type Db = Prisma.TransactionClient | PrismaService;

@Injectable()
export class OrganizationToolBindingsRepository {
  constructor(private readonly prisma: PrismaService) {}
  private db(tx?: Prisma.TransactionClient): Db {
    return tx ?? this.prisma;
  }

  findById(organizationId: string, id: string, tx?: Prisma.TransactionClient) {
    return this.db(tx).organizationToolBinding.findFirst({ where: { id, organizationId } });
  }

  list(
    organizationId: string,
    filters: { connectionId?: string; enabled?: boolean; connectorToolDefinitionId?: string },
    limit: number,
    cursor?: string,
    tx?: Prisma.TransactionClient,
  ) {
    return this.db(tx).organizationToolBinding.findMany({
      where: {
        organizationId,
        ...(filters.connectionId ? { connectionId: filters.connectionId } : {}),
        ...(filters.enabled !== undefined ? { enabled: filters.enabled } : {}),
        ...(filters.connectorToolDefinitionId ? { connectorToolDefinitionId: filters.connectorToolDefinitionId } : {}),
        ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  create(data: Prisma.OrganizationToolBindingUncheckedCreateInput, tx?: Prisma.TransactionClient) {
    return this.db(tx).organizationToolBinding.create({ data });
  }

  async updateGuarded(
    organizationId: string,
    id: string,
    expectedRevision: number,
    data: Prisma.OrganizationToolBindingUncheckedUpdateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<number> {
    const res = await this.db(tx).organizationToolBinding.updateMany({
      where: { id, organizationId, revision: expectedRevision },
      data: { ...data, revision: { increment: 1 } },
    });
    return res.count;
  }
}

@Injectable()
export class OperationToolBindingsRepository {
  constructor(private readonly prisma: PrismaService) {}
  private db(tx?: Prisma.TransactionClient): Db {
    return tx ?? this.prisma;
  }

  listByOperation(organizationId: string, operationId: string, includeRemoved = false, tx?: Prisma.TransactionClient) {
    return this.db(tx).operationToolBinding.findMany({
      where: { organizationId, operationId, ...(includeRemoved ? {} : { removedAt: null }) },
      orderBy: { createdAt: 'asc' },
    });
  }

  findById(organizationId: string, id: string, tx?: Prisma.TransactionClient) {
    return this.db(tx).operationToolBinding.findFirst({ where: { id, organizationId } });
  }

  /** Alias único entre os bindings NÃO removidos da operação. */
  findByAlias(organizationId: string, operationId: string, alias: string, tx?: Prisma.TransactionClient) {
    return this.db(tx).operationToolBinding.findFirst({ where: { organizationId, operationId, alias, removedAt: null } });
  }

  create(data: Prisma.OperationToolBindingUncheckedCreateInput, tx?: Prisma.TransactionClient) {
    return this.db(tx).operationToolBinding.create({ data });
  }

  async updateGuarded(
    organizationId: string,
    id: string,
    expectedRevision: number,
    data: Prisma.OperationToolBindingUncheckedUpdateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<number> {
    const res = await this.db(tx).operationToolBinding.updateMany({
      where: { id, organizationId, revision: expectedRevision, removedAt: null },
      data: { ...data, revision: { increment: 1 } },
    });
    return res.count;
  }

  /** Remoção LÓGICA (preserva histórico). Guardada por revision. */
  async softRemove(
    organizationId: string,
    id: string,
    expectedRevision: number,
    removedByUserId: string,
    at: Date,
    tx?: Prisma.TransactionClient,
  ): Promise<number> {
    const res = await this.db(tx).operationToolBinding.updateMany({
      where: { id, organizationId, revision: expectedRevision, removedAt: null },
      data: { removedAt: at, removedByUserId, enabled: false, revision: { increment: 1 } },
    });
    return res.count;
  }
}
