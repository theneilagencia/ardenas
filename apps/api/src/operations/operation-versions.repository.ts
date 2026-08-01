/**
 * Arden.AS API — repositório de versões de operação (ARDEN-BE-003).
 *
 * Escopado por tenant + operação. Aceita cliente de transação. Sem delete físico.
 */

import { Injectable } from '@nestjs/common';
import type { Prisma, OperationVersion as DbVersion } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

type Db = Prisma.TransactionClient;

export interface VersionsPage {
  rows: DbVersion[];
  hasNextPage: boolean;
  nextCursor: string | null;
}

@Injectable()
export class OperationVersionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  private db(tx?: Db): Db {
    return tx ?? (this.prisma as unknown as Db);
  }

  /** Lista versões da operação (mais recentes primeiro), paginação por número. */
  async list(
    organizationId: string,
    operationId: string,
    limit: number,
    cursor?: string,
  ): Promise<VersionsPage> {
    const where: Prisma.OperationVersionWhereInput = { organizationId, operationId };
    if (cursor && /^\d+$/.test(cursor)) {
      where.versionNumber = { lt: Number(cursor) };
    }
    const rows = await this.prisma.operationVersion.findMany({
      where,
      orderBy: { versionNumber: 'desc' },
      take: limit + 1,
    });
    const hasNextPage = rows.length > limit;
    const page = hasNextPage ? rows.slice(0, limit) : rows;
    const last = page[page.length - 1];
    const nextCursor = hasNextPage && last ? String(last.versionNumber) : null;
    return { rows: page, hasNextPage, nextCursor };
  }

  /** Versão por id, escopada por tenant + operação (nunca só por id). */
  findById(
    organizationId: string,
    operationId: string,
    versionId: string,
    tx?: Db,
  ): Promise<DbVersion | null> {
    return this.db(tx).operationVersion.findFirst({
      where: { id: versionId, organizationId, operationId },
    });
  }

  /** Versão por id no tenant (sem exigir operationId — para checagens de compare). */
  findByIdInOrg(organizationId: string, versionId: string, tx?: Db): Promise<DbVersion | null> {
    return this.db(tx).operationVersion.findFirst({
      where: { id: versionId, organizationId },
    });
  }

  findCurrentDraft(organizationId: string, operationId: string, tx?: Db): Promise<DbVersion | null> {
    return this.db(tx).operationVersion.findFirst({
      where: { organizationId, operationId, status: 'draft' },
      orderBy: { versionNumber: 'desc' },
    });
  }

  findPublished(organizationId: string, operationId: string, tx?: Db): Promise<DbVersion | null> {
    return this.db(tx).operationVersion.findFirst({
      where: { organizationId, operationId, status: 'published' },
    });
  }

  async maxVersionNumber(organizationId: string, operationId: string, tx?: Db): Promise<number> {
    const top = await this.db(tx).operationVersion.findFirst({
      where: { organizationId, operationId },
      orderBy: { versionNumber: 'desc' },
      select: { versionNumber: true },
    });
    return top?.versionNumber ?? 0;
  }

  create(data: Prisma.OperationVersionUncheckedCreateInput, tx?: Db): Promise<DbVersion> {
    return this.db(tx).operationVersion.create({ data });
  }

  update(
    organizationId: string,
    versionId: string,
    data: Prisma.OperationVersionUncheckedUpdateInput,
    tx?: Db,
  ): Promise<Prisma.BatchPayload> {
    return this.db(tx).operationVersion.updateMany({
      where: { id: versionId, organizationId },
      data,
    });
  }
}
