/**
 * Arden.AS API — repositório de configurações de modelo (ARDEN-BE-007.2).
 * Tenant-scoped: toda leitura exige `organizationId` (nunca findUnique por id só).
 */

import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

type Db = Prisma.TransactionClient | PrismaService;

export interface ModelConfigurationFilters {
  status?: string;
  providerDefinitionId?: string;
  modelId?: string;
  search?: string;
}

@Injectable()
export class ModelConfigurationsRepository {
  constructor(private readonly prisma: PrismaService) {}
  private db(tx?: Prisma.TransactionClient): Db {
    return tx ?? this.prisma;
  }

  async list(
    organizationId: string,
    filters: ModelConfigurationFilters,
    limit: number,
    cursor?: string,
    tx?: Prisma.TransactionClient,
  ) {
    return this.db(tx).modelConfiguration.findMany({
      where: {
        organizationId,
        ...(filters.status ? { status: filters.status as never } : {}),
        ...(filters.providerDefinitionId ? { providerDefinitionId: filters.providerDefinitionId } : {}),
        ...(filters.modelId ? { modelId: filters.modelId } : {}),
        ...(filters.search ? { name: { contains: filters.search, mode: 'insensitive' } } : {}),
        ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
    });
  }

  findById(organizationId: string, id: string, tx?: Prisma.TransactionClient) {
    return this.db(tx).modelConfiguration.findFirst({ where: { id, organizationId } });
  }

  create(data: Prisma.ModelConfigurationUncheckedCreateInput, tx?: Prisma.TransactionClient) {
    return this.db(tx).modelConfiguration.create({ data });
  }

  async updateGuarded(
    organizationId: string,
    id: string,
    expectedRevision: number,
    data: Prisma.ModelConfigurationUncheckedUpdateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<number> {
    const res = await this.db(tx).modelConfiguration.updateMany({
      where: { id, organizationId, revision: expectedRevision },
      data: { ...data, revision: { increment: 1 } },
    });
    return res.count;
  }

  /** Conta versões de agente que referenciam esta configuração (para bloqueio de uso). */
  countAgentVersions(modelConfigurationId: string, tx?: Prisma.TransactionClient) {
    return this.db(tx).agentVersion.count({ where: { modelConfigurationId } });
  }
}
