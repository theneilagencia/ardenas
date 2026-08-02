/**
 * Arden.AS API — repositórios de LEITURA do catálogo (ARDEN-BE-006.3).
 * Catálogo é system-managed (NÃO tenant-scoped). A ESCRITA (projeção) fica em
 * `project-catalog.ts` (função pura reutilizada pelo seed e pelo projector Nest).
 */

import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

type Db = Prisma.TransactionClient | PrismaService;

@Injectable()
export class ConnectorDefinitionsRepository {
  constructor(private readonly prisma: PrismaService) {}
  private db(tx?: Prisma.TransactionClient): Db {
    return tx ?? this.prisma;
  }

  findByKeyAndVersion(key: string, version: string, tx?: Prisma.TransactionClient) {
    return this.db(tx).connectorDefinition.findFirst({ where: { key, version } });
  }

  findById(id: string, tx?: Prisma.TransactionClient) {
    return this.db(tx).connectorDefinition.findUnique({ where: { id } });
  }

  list(tx?: Prisma.TransactionClient) {
    return this.db(tx).connectorDefinition.findMany({ orderBy: [{ key: 'asc' }, { version: 'asc' }] });
  }
}

@Injectable()
export class ConnectorToolDefinitionsRepository {
  constructor(private readonly prisma: PrismaService) {}
  private db(tx?: Prisma.TransactionClient): Db {
    return tx ?? this.prisma;
  }

  findByConnectorAndKey(connectorDefinitionId: string, key: string, version: string, tx?: Prisma.TransactionClient) {
    return this.db(tx).connectorToolDefinition.findFirst({ where: { connectorDefinitionId, key, version } });
  }

  findByActionKey(actionKey: string, tx?: Prisma.TransactionClient) {
    return this.db(tx).connectorToolDefinition.findFirst({ where: { actionKey, active: true } });
  }

  listByConnector(connectorDefinitionId: string, tx?: Prisma.TransactionClient) {
    return this.db(tx).connectorToolDefinition.findMany({ where: { connectorDefinitionId }, orderBy: { key: 'asc' } });
  }
}
