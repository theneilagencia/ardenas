/**
 * Arden.AS API — gravação append-only de eventos e evidências (ARDEN-BE-005).
 *
 * Eventos têm sequência MONOTÔNICA por execução (unicidade no banco). Evidências
 * carregam hash do conteúdo. Ambos são append-only e sanitizados: nunca gravam
 * token/segredo. Escrevem SEMPRE dentro da transação do comando/worker.
 */

import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { Prisma, ExecutionActorType, EvidenceType } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { canonicalize } from '../enforcement/action-payload';

const SENSITIVE = /(authorization|token|secret|password|cookie|bearer)/i;

/** Remove chaves sensíveis em profundidade antes de persistir. */
export function sanitizeContent(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeContent);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SENSITIVE.test(k) ? '[REDACTED]' : sanitizeContent(v);
    }
    return out;
  }
  return value;
}

export function hashContent(content: unknown): string {
  return createHash('sha256').update(JSON.stringify(canonicalize(sanitizeContent(content)))).digest('hex');
}

export interface RecordEventInput {
  organizationId: string;
  executionRunId: string;
  executionStepId?: string | null;
  eventType: string;
  actorType: ExecutionActorType;
  actorId?: string | null;
  correlationId: string;
  causationId?: string | null;
  payload?: Record<string, unknown>;
}

export interface RecordEvidenceInput {
  organizationId: string;
  executionRunId: string;
  executionStepId?: string | null;
  evidenceType: EvidenceType;
  content: Record<string, unknown>;
  createdByType: ExecutionActorType;
  createdById?: string | null;
  correlationId: string;
  storageReference?: string | null;
  mimeType?: string | null;
}

@Injectable()
export class ExecutionRecorder {
  constructor(private readonly prisma: PrismaService) {}

  /** Append de evento com sequência = max+1 na mesma transação. */
  async recordEvent(tx: Prisma.TransactionClient, input: RecordEventInput) {
    const last = await tx.executionEvent.findFirst({
      where: { executionRunId: input.executionRunId },
      orderBy: { sequence: 'desc' },
      select: { sequence: true },
    });
    const sequence = (last ? last.sequence : 0n) + 1n;
    return tx.executionEvent.create({
      data: {
        organizationId: input.organizationId,
        executionRunId: input.executionRunId,
        executionStepId: input.executionStepId ?? null,
        sequence,
        eventType: input.eventType,
        actorType: input.actorType,
        actorId: input.actorId ?? null,
        correlationId: input.correlationId,
        causationId: input.causationId ?? null,
        payload: (sanitizeContent(input.payload ?? {}) ?? {}) as Prisma.InputJsonObject,
      },
    });
  }

  /** Append de evento em transação própria (fora de um comando maior). */
  async recordEventStandalone(
    organizationId: string,
    executionRunId: string,
    eventType: string,
    actorType: ExecutionActorType,
    correlationId: string,
    payload: Record<string, unknown> = {},
  ) {
    return this.prisma.$transaction((tx) =>
      this.recordEvent(tx, { organizationId, executionRunId, eventType, actorType, correlationId, payload }),
    );
  }

  async recordEvidence(tx: Prisma.TransactionClient, input: RecordEvidenceInput) {
    const content = sanitizeContent(input.content) as Prisma.InputJsonObject;
    return tx.evidenceRecord.create({
      data: {
        organizationId: input.organizationId,
        executionRunId: input.executionRunId,
        executionStepId: input.executionStepId ?? null,
        evidenceType: input.evidenceType,
        content,
        contentHash: hashContent(input.content),
        storageReference: input.storageReference ?? null,
        mimeType: input.mimeType ?? null,
        createdByType: input.createdByType,
        createdById: input.createdById ?? null,
        correlationId: input.correlationId,
      },
    });
  }
}
