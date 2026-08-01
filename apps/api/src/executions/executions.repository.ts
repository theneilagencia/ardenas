/**
 * Arden.AS API — acesso a dados de execução (ARDEN-BE-005).
 * Toda leitura é escopada por organização. Aceita cliente de transação.
 */

import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

type Db = Prisma.TransactionClient | PrismaService;

@Injectable()
export class ExecutionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  private db(tx?: Prisma.TransactionClient): Db {
    return tx ?? this.prisma;
  }

  findRun(organizationId: string, id: string, tx?: Prisma.TransactionClient) {
    return this.db(tx).executionRun.findFirst({ where: { id, organizationId } });
  }

  /** Carrega uma execução só por id (worker) — tenant vem da própria linha. */
  findRunById(id: string, tx?: Prisma.TransactionClient) {
    return this.db(tx).executionRun.findUnique({ where: { id } });
  }

  listRuns(
    organizationId: string,
    filters: { status?: string; operationId?: string },
    limit: number,
    cursor?: string,
    tx?: Prisma.TransactionClient,
  ) {
    return this.db(tx).executionRun.findMany({
      where: {
        organizationId,
        ...(filters.status ? { status: filters.status as never } : {}),
        ...(filters.operationId ? { operationId: filters.operationId } : {}),
        ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  listSteps(organizationId: string, executionRunId: string, tx?: Prisma.TransactionClient) {
    return this.db(tx).executionStep.findMany({ where: { organizationId, executionRunId }, orderBy: { sequence: 'asc' } });
  }

  stepsForRun(executionRunId: string, tx?: Prisma.TransactionClient) {
    return this.db(tx).executionStep.findMany({ where: { executionRunId }, orderBy: { sequence: 'asc' } });
  }

  findStep(organizationId: string, executionRunId: string, stepId: string, tx?: Prisma.TransactionClient) {
    return this.db(tx).executionStep.findFirst({ where: { id: stepId, organizationId, executionRunId } });
  }

  listEvents(organizationId: string, executionRunId: string, limit: number, cursor?: string, tx?: Prisma.TransactionClient) {
    return this.db(tx).executionEvent.findMany({
      where: { organizationId, executionRunId, ...(cursor ? { sequence: { gt: BigInt(cursor) } } : {}) },
      orderBy: { sequence: 'asc' },
      take: limit,
    });
  }

  listEvidence(organizationId: string, executionRunId: string, tx?: Prisma.TransactionClient) {
    return this.db(tx).evidenceRecord.findMany({ where: { organizationId, executionRunId }, orderBy: { createdAt: 'asc' } });
  }

  findEvidence(organizationId: string, executionRunId: string, evidenceId: string, tx?: Prisma.TransactionClient) {
    return this.db(tx).evidenceRecord.findFirst({ where: { id: evidenceId, organizationId, executionRunId } });
  }
}
