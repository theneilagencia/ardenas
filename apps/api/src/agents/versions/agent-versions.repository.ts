/**
 * Arden.AS API — repositório de versões de agente (ARDEN-BE-007.2).
 * Tenant-scoped: toda leitura exige `organizationId` (nunca findUnique por id só).
 * Versões PUBLISHED/RETIRED nunca sofrem update de conteúdo (garantido no service).
 */

import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

type Db = Prisma.TransactionClient | PrismaService;

@Injectable()
export class AgentVersionsRepository {
  constructor(private readonly prisma: PrismaService) {}
  private db(tx?: Prisma.TransactionClient): Db {
    return tx ?? this.prisma;
  }

  async list(
    organizationId: string,
    agentDefinitionId: string,
    filters: { status?: string; versionNumber?: number },
    limit: number,
    cursor?: string,
    tx?: Prisma.TransactionClient,
  ) {
    return this.db(tx).agentVersion.findMany({
      where: {
        organizationId,
        agentDefinitionId,
        ...(filters.status ? { status: filters.status as never } : {}),
        ...(filters.versionNumber ? { versionNumber: filters.versionNumber } : {}),
        ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
    });
  }

  findById(organizationId: string, id: string, tx?: Prisma.TransactionClient) {
    return this.db(tx).agentVersion.findFirst({ where: { id, organizationId } });
  }

  findByIdForAgent(organizationId: string, agentDefinitionId: string, id: string, tx?: Prisma.TransactionClient) {
    return this.db(tx).agentVersion.findFirst({ where: { id, organizationId, agentDefinitionId } });
  }

  async maxVersionNumber(agentDefinitionId: string, tx?: Prisma.TransactionClient): Promise<number> {
    const row = await this.db(tx).agentVersion.findFirst({
      where: { agentDefinitionId },
      orderBy: { versionNumber: 'desc' },
      select: { versionNumber: true },
    });
    return row?.versionNumber ?? 0;
  }

  create(data: Prisma.AgentVersionUncheckedCreateInput, tx?: Prisma.TransactionClient) {
    return this.db(tx).agentVersion.create({ data });
  }

  async updateGuarded(
    organizationId: string,
    id: string,
    expectedRevision: number,
    data: Prisma.AgentVersionUncheckedUpdateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<number> {
    const res = await this.db(tx).agentVersion.updateMany({
      where: { id, organizationId, revision: expectedRevision },
      data: { ...data, revision: { increment: 1 } },
    });
    return res.count;
  }

  /**
   * Transição de estado guardada por revisão E por estado de origem — impede publicar
   * duas vezes em corrida (só a linha ainda em `fromStatus` é afetada).
   */
  async transitionGuarded(
    organizationId: string,
    id: string,
    expectedRevision: number,
    fromStatus: string,
    data: Prisma.AgentVersionUncheckedUpdateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<number> {
    const res = await this.db(tx).agentVersion.updateMany({
      where: { id, organizationId, revision: expectedRevision, status: fromStatus as never },
      data: { ...data, revision: { increment: 1 } },
    });
    return res.count;
  }
}
