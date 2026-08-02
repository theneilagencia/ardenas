/**
 * Arden.AS API — repositório de definições de agente (ARDEN-BE-007.2).
 * Tenant-scoped: toda leitura exige `organizationId` (nunca findUnique por id só).
 */

import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

type Db = Prisma.TransactionClient | PrismaService;

export interface AgentFilters {
  status?: string;
  search?: string;
  createdByUserId?: string;
}

@Injectable()
export class AgentDefinitionsRepository {
  constructor(private readonly prisma: PrismaService) {}
  private db(tx?: Prisma.TransactionClient): Db {
    return tx ?? this.prisma;
  }

  async list(
    organizationId: string,
    filters: AgentFilters,
    limit: number,
    cursor?: string,
    tx?: Prisma.TransactionClient,
  ) {
    return this.db(tx).agentDefinition.findMany({
      where: {
        organizationId,
        ...(filters.status ? { status: filters.status as never } : {}),
        ...(filters.createdByUserId ? { createdByUserId: filters.createdByUserId } : {}),
        ...(filters.search ? { name: { contains: filters.search, mode: 'insensitive' } } : {}),
        ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
    });
  }

  findById(organizationId: string, id: string, tx?: Prisma.TransactionClient) {
    return this.db(tx).agentDefinition.findFirst({ where: { id, organizationId } });
  }

  findByKey(organizationId: string, key: string, tx?: Prisma.TransactionClient) {
    return this.db(tx).agentDefinition.findFirst({ where: { organizationId, key } });
  }

  create(data: Prisma.AgentDefinitionUncheckedCreateInput, tx?: Prisma.TransactionClient) {
    return this.db(tx).agentDefinition.create({ data });
  }

  async updateGuarded(
    organizationId: string,
    id: string,
    expectedRevision: number,
    data: Prisma.AgentDefinitionUncheckedUpdateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<number> {
    const res = await this.db(tx).agentDefinition.updateMany({
      where: { id, organizationId, revision: expectedRevision },
      data: { ...data, revision: { increment: 1 } },
    });
    return res.count;
  }

  /**
   * Atualiza estado + ponteiro de versão publicada na publicação, guardado por revisão.
   * `status` só é alterado quando informado (ex.: DRAFT→ACTIVE ao publicar a primeira).
   */
  async publishPointerGuarded(
    organizationId: string,
    id: string,
    expectedRevision: number,
    data: { currentPublishedVersionId: string; status?: string },
    tx?: Prisma.TransactionClient,
  ): Promise<number> {
    const res = await this.db(tx).agentDefinition.updateMany({
      where: { id, organizationId, revision: expectedRevision },
      data: {
        currentPublishedVersionId: data.currentPublishedVersionId,
        ...(data.status ? { status: data.status as never } : {}),
        revision: { increment: 1 },
      },
    });
    return res.count;
  }

  /** Limpa o ponteiro de versão publicada (ao retirar a versão publicada atual). */
  async clearPublishedPointerGuarded(
    organizationId: string,
    id: string,
    expectedRevision: number,
    tx?: Prisma.TransactionClient,
  ): Promise<number> {
    const res = await this.db(tx).agentDefinition.updateMany({
      where: { id, organizationId, revision: expectedRevision },
      data: { currentPublishedVersionId: null, revision: { increment: 1 } },
    });
    return res.count;
  }
}
