/**
 * Arden.AS API — leitura da auditoria (ARDEN-BE-003).
 *
 * SOMENTE LEITURA. Tenant obrigatório (validado pelo guard). Paginação por CURSOR
 * determinística (occurredAt desc, id desc — nunca offset). Recurso de outro tenant
 * não é revelado (404). Não há update/delete/POST público de auditoria.
 */

import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  type ListAuditEventsQuery,
  type AuditEvent,
  type PaginationMeta,
} from '@arden/contracts';
import { PrismaService } from '../database/prisma.service';
import { notFound } from '../common/errors/api-error';
import type { AuthenticatedRequestContext } from '../identity/request-context';
import { toAuditEventContract } from '../operations/operation.serializers';

interface AuditCursor {
  occurredAt: string;
  id: string;
}

function encodeCursor(occurredAt: Date, id: string): string {
  return Buffer.from(`${occurredAt.toISOString()}|${id}`, 'utf8').toString('base64url');
}

function decodeCursor(raw: string): AuditCursor | null {
  try {
    const [occurredAt, id] = Buffer.from(raw, 'base64url').toString('utf8').split('|');
    if (!occurredAt || !id) return null;
    return { occurredAt, id };
  } catch {
    return null;
  }
}

export interface AuditListResult {
  data: AuditEvent[];
  pagination: PaginationMeta;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async list(ctx: AuthenticatedRequestContext, query: ListAuditEventsQuery): Promise<AuditListResult> {
    const organizationId = ctx.organizationId as string;

    const where: Prisma.AuditEventWhereInput = { organizationId };
    if (query.actorId) where.actorUserId = query.actorId;
    if (query.action) where.action = query.action;
    if (query.resourceType) where.resourceType = query.resourceType;
    if (query.resourceId) where.resourceId = query.resourceId;
    if (query.correlationId) where.correlationId = query.correlationId;
    if (query.from || query.to) {
      where.occurredAt = {};
      if (query.from) where.occurredAt.gte = new Date(query.from);
      if (query.to) where.occurredAt.lte = new Date(query.to);
    }

    // Cursor: mantém a ordenação determinística (occurredAt, id) desc.
    if (query.cursor) {
      const cursor = decodeCursor(query.cursor);
      if (cursor) {
        const at = new Date(cursor.occurredAt);
        where.AND = [
          {
            OR: [
              { occurredAt: { lt: at } },
              { occurredAt: at, id: { lt: cursor.id } },
            ],
          },
        ];
      }
    }

    const rows = await this.prisma.auditEvent.findMany({
      where,
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
    });

    const hasNextPage = rows.length > query.limit;
    const page = hasNextPage ? rows.slice(0, query.limit) : rows;
    const last = page[page.length - 1];
    const nextCursor = hasNextPage && last ? encodeCursor(last.occurredAt, last.id) : null;

    return {
      data: page.map(toAuditEventContract),
      pagination: {
        cursor: query.cursor ?? null,
        nextCursor,
        hasNextPage,
        limit: query.limit,
      },
    };
  }

  async get(ctx: AuthenticatedRequestContext, eventId: string): Promise<AuditEvent> {
    const organizationId = ctx.organizationId as string;
    const row = await this.prisma.auditEvent.findFirst({ where: { id: eventId, organizationId } });
    if (!row) throw notFound('Evento de auditoria não encontrado.');
    return toAuditEventContract(row);
  }
}
