/**
 * Arden.AS API — repositórios de webhooks (ARDEN-BE-006.3).
 * TENANT-SCOPED. Endpoint: token só como hash. Delivery: append-oriented,
 * transições só por service. Lookup por `pathTokenHash` é global (o token não
 * identifica a org diretamente) mas o resultado carrega o tenant persistido.
 */

import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

type Db = Prisma.TransactionClient | PrismaService;

@Injectable()
export class WebhookEndpointsRepository {
  constructor(private readonly prisma: PrismaService) {}
  private db(tx?: Prisma.TransactionClient): Db {
    return tx ?? this.prisma;
  }

  findById(organizationId: string, id: string, tx?: Prisma.TransactionClient) {
    return this.db(tx).webhookEndpoint.findFirst({ where: { id, organizationId } });
  }

  /** Lookup pelo hash do token (entrada pública). Tenant vem da própria linha. */
  findByPathTokenHash(pathTokenHash: string, tx?: Prisma.TransactionClient) {
    return this.db(tx).webhookEndpoint.findFirst({ where: { pathTokenHash } });
  }

  list(
    organizationId: string,
    filters: { status?: Prisma.WebhookEndpointWhereInput['status']; connectionId?: string; operationId?: string },
    limit: number,
    cursor?: string,
    tx?: Prisma.TransactionClient,
  ) {
    return this.db(tx).webhookEndpoint.findMany({
      where: {
        organizationId,
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.connectionId ? { connectionId: filters.connectionId } : {}),
        ...(filters.operationId ? { operationId: filters.operationId } : {}),
        ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  create(data: Prisma.WebhookEndpointUncheckedCreateInput, tx?: Prisma.TransactionClient) {
    return this.db(tx).webhookEndpoint.create({ data });
  }

  async updateGuarded(
    organizationId: string,
    id: string,
    expectedRevision: number,
    data: Prisma.WebhookEndpointUncheckedUpdateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<number> {
    const res = await this.db(tx).webhookEndpoint.updateMany({
      where: { id, organizationId, revision: expectedRevision },
      data: { ...data, revision: { increment: 1 } },
    });
    return res.count;
  }
}

@Injectable()
export class WebhookDeliveriesRepository {
  constructor(private readonly prisma: PrismaService) {}
  private db(tx?: Prisma.TransactionClient): Db {
    return tx ?? this.prisma;
  }

  findByExternalDeliveryId(organizationId: string, webhookEndpointId: string, externalDeliveryId: string, tx?: Prisma.TransactionClient) {
    return this.db(tx).webhookDelivery.findFirst({ where: { organizationId, webhookEndpointId, externalDeliveryId } });
  }

  findById(organizationId: string, id: string, tx?: Prisma.TransactionClient) {
    return this.db(tx).webhookDelivery.findFirst({ where: { id, organizationId } });
  }

  list(organizationId: string, webhookEndpointId: string, limit: number, cursor?: string, tx?: Prisma.TransactionClient) {
    return this.db(tx).webhookDelivery.findMany({
      where: { organizationId, webhookEndpointId, ...(cursor ? { receivedAt: { lt: new Date(cursor) } } : {}) },
      orderBy: { receivedAt: 'desc' },
      take: limit,
    });
  }

  create(data: Prisma.WebhookDeliveryUncheckedCreateInput, tx?: Prisma.TransactionClient) {
    return this.db(tx).webhookDelivery.create({ data });
  }

  /** Transição guardada pelo status atual (append-oriented; nunca update genérico). */
  async transition(
    organizationId: string,
    id: string,
    fromStatus: Prisma.WebhookDeliveryWhereInput['status'],
    data: Prisma.WebhookDeliveryUncheckedUpdateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<number> {
    const res = await this.db(tx).webhookDelivery.updateMany({
      where: { id, organizationId, status: fromStatus },
      data,
    });
    return res.count;
  }
}
