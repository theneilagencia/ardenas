/**
 * Arden.AS API — repositório de providers de modelo (ARDEN-BE-007.2).
 * System-scoped (sem tenant). Leitura do catálogo projetado + suporte à projeção.
 */

import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

type Db = Prisma.TransactionClient | PrismaService;

@Injectable()
export class ModelProviderDefinitionsRepository {
  constructor(private readonly prisma: PrismaService) {}
  private db(tx?: Prisma.TransactionClient): Db {
    return tx ?? this.prisma;
  }

  list(tx?: Prisma.TransactionClient) {
    return this.db(tx).modelProviderDefinition.findMany({ orderBy: [{ key: 'asc' }, { version: 'asc' }] });
  }

  findByKeyAndVersion(key: string, version: string, tx?: Prisma.TransactionClient) {
    return this.db(tx).modelProviderDefinition.findFirst({ where: { key, version } });
  }

  findByKeyLatest(key: string, tx?: Prisma.TransactionClient) {
    return this.db(tx).modelProviderDefinition.findFirst({
      where: { key },
      orderBy: { version: 'desc' },
    });
  }

  findById(id: string, tx?: Prisma.TransactionClient) {
    return this.db(tx).modelProviderDefinition.findUnique({ where: { id } });
  }
}
