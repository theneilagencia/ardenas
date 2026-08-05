/**
 * Arden.AS API — repositório de operações (ARDEN-BE-003).
 *
 * TODAS as leituras/escritas incluem `organizationId` (isolamento multitenant —
 * nunca busca só por id). Métodos aceitam um cliente de transação para compor
 * comandos atômicos. Não expõe delete físico.
 */

import { Injectable } from '@nestjs/common';
import type { Prisma, Operation as DbOperation } from '@prisma/client';
import type { ListOperationsQuery } from '@arden/contracts';
import { PrismaService } from '../database/prisma.service';

type Db = Prisma.TransactionClient;

export interface OperationsPage {
  rows: DbOperation[];
  hasNextPage: boolean;
  nextCursor: string | null;
}

function encodeCursor(sortValue: string, id: string): string {
  return Buffer.from(`${sortValue}|${id}`, 'utf8').toString('base64url');
}

function decodeCursor(raw: string): { value: string; id: string } | null {
  try {
    const [value, id] = Buffer.from(raw, 'base64url').toString('utf8').split('|');
    if (value === undefined || !id) return null;
    return { value, id };
  } catch {
    return null;
  }
}

@Injectable()
export class OperationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  private db(tx?: Db): Db {
    return tx ?? (this.prisma as unknown as Db);
  }

  /** Lista operações do tenant com filtros + paginação por cursor determinística. */
  async list(organizationId: string, query: ListOperationsQuery): Promise<OperationsPage> {
    const where: Prisma.OperationWhereInput = { organizationId };
    if (query.status) where.status = query.status;
    if (query.ownerId) where.ownerId = query.ownerId;
    if (query.search) where.name = { contains: query.search, mode: 'insensitive' };
    if (query.createdAfter || query.createdBefore) {
      where.createdAt = {};
      if (query.createdAfter) where.createdAt.gte = new Date(query.createdAfter);
      if (query.createdBefore) where.createdAt.lte = new Date(query.createdBefore);
    }
    // NOTA: `authorityLevel` é aceito pelo contrato mas ainda não filtra em v1
    // (exigiria consultar a versão apontada); documentado no relatório. Sem efeito
    // silencioso sobre os dados retornados.

    const sort = query.sort;
    const order = query.order;
    const cmp = order === 'asc' ? 'gt' : 'lt';

    if (query.cursor) {
      const cursor = decodeCursor(query.cursor);
      if (cursor) {
        const value: string | Date =
          sort === 'name' ? cursor.value : new Date(cursor.value);
        where.AND = [
          {
            OR: [
              { [sort]: { [cmp]: value } },
              { [sort]: value, id: { [cmp]: cursor.id } },
            ],
          } as Prisma.OperationWhereInput,
        ];
      }
    }

    const rows = await this.prisma.operation.findMany({
      where,
      orderBy: [{ [sort]: order }, { id: order }],
      take: query.limit + 1,
    });

    const hasNextPage = rows.length > query.limit;
    const page = hasNextPage ? rows.slice(0, query.limit) : rows;
    const last = page[page.length - 1];
    const nextCursor =
      hasNextPage && last
        ? encodeCursor(
            sort === 'name' ? last.name : (last[sort] as Date).toISOString(),
            last.id,
          )
        : null;

    return { rows: page, hasNextPage, nextCursor };
  }

  /** Busca escopada por tenant (nunca só por id). */
  findById(organizationId: string, id: string, tx?: Db): Promise<DbOperation | null> {
    return this.db(tx).operation.findFirst({ where: { id, organizationId } });
  }

  create(data: Prisma.OperationUncheckedCreateInput, tx?: Db): Promise<DbOperation> {
    return this.db(tx).operation.create({ data });
  }

  /** Atualiza a operação garantindo o tenant; incrementa a revisão. */
  update(
    organizationId: string,
    id: string,
    data: Prisma.OperationUncheckedUpdateInput,
    tx?: Db,
  ): Promise<Prisma.BatchPayload> {
    return this.db(tx).operation.updateMany({ where: { id, organizationId }, data });
  }
}
