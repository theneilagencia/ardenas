/**
 * Arden.AS API — repositórios de conexões e credenciais (ARDEN-BE-006.3).
 * TENANT-SCOPED: toda leitura/escrita exige `organizationId` (findFirst com org,
 * nunca findUnique só por id). Aceitam cliente de transação.
 */

import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

type Db = Prisma.TransactionClient | PrismaService;

@Injectable()
export class OrganizationConnectionsRepository {
  constructor(private readonly prisma: PrismaService) {}
  private db(tx?: Prisma.TransactionClient): Db {
    return tx ?? this.prisma;
  }

  findById(organizationId: string, id: string, tx?: Prisma.TransactionClient) {
    return this.db(tx).organizationConnection.findFirst({ where: { id, organizationId } });
  }

  list(
    organizationId: string,
    filters: { connectorDefinitionId?: string; status?: Prisma.OrganizationConnectionWhereInput['status']; search?: string },
    limit: number,
    cursor?: string,
    tx?: Prisma.TransactionClient,
  ) {
    return this.db(tx).organizationConnection.findMany({
      where: {
        organizationId,
        ...(filters.connectorDefinitionId ? { connectorDefinitionId: filters.connectorDefinitionId } : {}),
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.search ? { name: { contains: filters.search, mode: 'insensitive' } } : {}),
        ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  create(data: Prisma.OrganizationConnectionUncheckedCreateInput, tx?: Prisma.TransactionClient) {
    return this.db(tx).organizationConnection.create({ data });
  }

  /** Update guardado por (id, tenant, revision). Retorna o número de linhas afetadas. */
  async updateGuarded(
    organizationId: string,
    id: string,
    expectedRevision: number,
    data: Prisma.OrganizationConnectionUncheckedUpdateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<number> {
    const res = await this.db(tx).organizationConnection.updateMany({
      where: { id, organizationId, revision: expectedRevision },
      data: { ...data, revision: { increment: 1 } },
    });
    return res.count;
  }

  setCurrentCredential(organizationId: string, id: string, credentialVersionId: string | null, tx?: Prisma.TransactionClient) {
    return this.db(tx).organizationConnection.updateMany({ where: { id, organizationId }, data: { currentCredentialVersionId: credentialVersionId } });
  }
}

@Injectable()
export class ConnectionCredentialVersionsRepository {
  constructor(private readonly prisma: PrismaService) {}
  private db(tx?: Prisma.TransactionClient): Db {
    return tx ?? this.prisma;
  }

  list(organizationId: string, connectionId: string, tx?: Prisma.TransactionClient) {
    return this.db(tx).connectionCredentialVersion.findMany({
      where: { organizationId, connectionId },
      orderBy: { versionNumber: 'desc' },
    });
  }

  findById(organizationId: string, id: string, tx?: Prisma.TransactionClient) {
    return this.db(tx).connectionCredentialVersion.findFirst({ where: { id, organizationId } });
  }

  findActive(organizationId: string, connectionId: string, tx?: Prisma.TransactionClient) {
    return this.db(tx).connectionCredentialVersion.findFirst({ where: { organizationId, connectionId, status: 'ACTIVE' } });
  }

  async nextVersionNumber(connectionId: string, tx?: Prisma.TransactionClient): Promise<number> {
    const last = await this.db(tx).connectionCredentialVersion.findFirst({
      where: { connectionId },
      orderBy: { versionNumber: 'desc' },
      select: { versionNumber: true },
    });
    return (last?.versionNumber ?? 0) + 1;
  }

  /**
   * Cria uma versão PENDING — SEM segredo (campos criptográficos NULL). O cofre
   * (006.4) preencherá encryptedSecret/nonce/authTag/fingerprint na ativação.
   */
  createPending(
    input: { organizationId: string; connectionId: string; versionNumber: number; createdByUserId: string; metadata?: Prisma.InputJsonValue },
    tx?: Prisma.TransactionClient,
  ) {
    return this.db(tx).connectionCredentialVersion.create({
      data: {
        organizationId: input.organizationId,
        connectionId: input.connectionId,
        versionNumber: input.versionNumber,
        status: 'PENDING',
        encryptedSecret: null,
        encryptedDataKey: null,
        algorithm: null,
        keyVersion: null,
        nonce: null,
        authTag: null,
        fingerprint: null,
        metadata: input.metadata ?? {},
        createdByUserId: input.createdByUserId,
      },
    });
  }

  /** PENDING → ACTIVE. Guardado pelo status atual (idempotência do lifecycle). */
  async activate(organizationId: string, id: string, at: Date, tx?: Prisma.TransactionClient): Promise<number> {
    const res = await this.db(tx).connectionCredentialVersion.updateMany({
      where: { id, organizationId, status: 'PENDING' },
      data: { status: 'ACTIVE', activatedAt: at },
    });
    return res.count;
  }

  supersede(organizationId: string, id: string, at: Date, tx?: Prisma.TransactionClient) {
    return this.db(tx).connectionCredentialVersion.updateMany({
      where: { id, organizationId, status: 'ACTIVE' },
      data: { status: 'SUPERSEDED', supersededAt: at },
    });
  }

  revoke(organizationId: string, id: string, at: Date, tx?: Prisma.TransactionClient) {
    return this.db(tx).connectionCredentialVersion.updateMany({
      where: { id, organizationId, status: { in: ['PENDING', 'ACTIVE', 'SUPERSEDED'] } },
      data: { status: 'REVOKED', revokedAt: at },
    });
  }
}
