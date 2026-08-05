/**
 * Arden.AS API — fila durável de execução (ARDEN-BE-005 §6/§17/§18).
 *
 * Tabela própria PostgreSQL. Aquisição atômica com `FOR UPDATE SKIP LOCKED` (dois
 * workers nunca pegam o mesmo job). Lease renovável; jobs órfãos (lease expirado)
 * voltam a ficar disponíveis. Sem fila em memória, sem setTimeout como mecanismo.
 */

import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

export interface AcquiredJob {
  id: string;
  organizationId: string;
  executionRunId: string;
  attempts: number;
}

@Injectable()
export class ExecutionQueue {
  constructor(private readonly prisma: PrismaService) {}

  /** Enfileira um job idempotentemente (dedup key único). Usa a tx do comando. */
  async enqueue(
    tx: Prisma.TransactionClient,
    input: { organizationId: string; executionRunId: string; deduplicationKey: string; payload?: Record<string, unknown>; availableAt?: Date },
  ): Promise<void> {
    const existing = await tx.executionJob.findFirst({ where: { deduplicationKey: input.deduplicationKey }, select: { id: true } });
    if (existing) return;
    await tx.executionJob.create({
      data: {
        organizationId: input.organizationId,
        executionRunId: input.executionRunId,
        status: 'QUEUED',
        payload: (input.payload ?? {}) as Prisma.InputJsonObject,
        availableAt: input.availableAt ?? new Date(),
        deduplicationKey: input.deduplicationKey,
      },
    });
  }

  /** Aquisição atômica do próximo job elegível para um worker. */
  async acquire(workerId: string, leaseSeconds: number): Promise<AcquiredJob | null> {
    const rows = await this.prisma.$queryRaw<
      Array<{ id: string; organization_id: string; execution_run_id: string; attempts: number }>
    >`
      UPDATE execution_jobs
         SET status = 'RUNNING', locked_by = ${workerId}, locked_at = now(),
             lease_expires_at = now() + make_interval(secs => ${leaseSeconds}::double precision),
             attempts = attempts + 1, updated_at = now()
       WHERE id = (
         SELECT id FROM execution_jobs
          WHERE status IN ('QUEUED', 'RETRY_WAIT') AND available_at <= now()
          ORDER BY available_at ASC
          FOR UPDATE SKIP LOCKED
          LIMIT 1
       )
      RETURNING id, organization_id, execution_run_id, attempts;
    `;
    const row = rows[0];
    if (!row) return null;
    return { id: row.id, organizationId: row.organization_id, executionRunId: row.execution_run_id, attempts: row.attempts };
  }

  /** Renova o lease enquanto o worker processa. */
  async heartbeat(jobId: string, workerId: string, leaseSeconds: number): Promise<boolean> {
    const res = await this.prisma.$executeRaw`
      UPDATE execution_jobs
         SET lease_expires_at = now() + make_interval(secs => ${leaseSeconds}::double precision), updated_at = now()
       WHERE id = ${jobId}::uuid AND locked_by = ${workerId} AND status = 'RUNNING';
    `;
    return res > 0;
  }

  async complete(tx: Prisma.TransactionClient, jobId: string): Promise<void> {
    await tx.executionJob.updateMany({ where: { id: jobId }, data: { status: 'COMPLETED', lockedBy: null, leaseExpiresAt: null, updatedAt: new Date() } });
  }

  /** Reagenda (RETRY_WAIT) ou encerra (FAILED) o job. */
  async release(
    tx: Prisma.TransactionClient,
    jobId: string,
    input: { retry: boolean; availableAt?: Date; lastError?: string },
  ): Promise<void> {
    await tx.executionJob.updateMany({
      where: { id: jobId },
      data: {
        status: input.retry ? 'RETRY_WAIT' : 'FAILED',
        availableAt: input.retry ? (input.availableAt ?? new Date()) : undefined,
        lockedBy: null,
        leaseExpiresAt: null,
        lastError: input.lastError ?? null,
        updatedAt: new Date(),
      },
    });
  }

  /** Menor `availableAt` entre jobs pendentes (para drenagem determinística). */
  async earliestAvailableAt(): Promise<Date | null> {
    const row = await this.prisma.executionJob.findFirst({
      where: { status: { in: ['QUEUED', 'RETRY_WAIT'] } },
      orderBy: { availableAt: 'asc' },
      select: { availableAt: true },
    });
    return row?.availableAt ?? null;
  }

  async cancel(tx: Prisma.TransactionClient, executionRunId: string): Promise<void> {
    await tx.executionJob.updateMany({
      where: { executionRunId, status: { in: ['QUEUED', 'RETRY_WAIT', 'RUNNING'] } },
      data: { status: 'CANCELLED', lockedBy: null, leaseExpiresAt: null, updatedAt: new Date() },
    });
  }

  /** Recupera jobs com lease expirado → voltam a QUEUED. Retorna os run ids afetados. */
  async recoverExpiredLeases(): Promise<Array<{ id: string; executionRunId: string }>> {
    const rows = await this.prisma.$queryRaw<Array<{ id: string; execution_run_id: string }>>`
      UPDATE execution_jobs
         SET status = 'QUEUED', locked_by = null, lease_expires_at = null,
             available_at = now(), last_error = 'lease_expired', updated_at = now()
       WHERE status = 'RUNNING' AND lease_expires_at IS NOT NULL AND lease_expires_at < now()
      RETURNING id, execution_run_id;
    `;
    return rows.map((r) => ({ id: r.id, executionRunId: r.execution_run_id }));
  }
}
