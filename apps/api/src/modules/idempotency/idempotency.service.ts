/**
 * Arden.AS API — serviço de idempotência (ARDEN-BE-001).
 *
 * Infraestrutura TÉCNICA (tabela `idempotency_records`). Ainda NÃO aplicada a
 * endpoints de negócio (inexistentes). Contrato: mesma chave + mesmo body →
 * mesma resposta; mesma chave + body diferente → conflito. Escopo por (método,
 * rota, chave). NÃO retorna sucesso superficial: distingue new/replay/conflict.
 */

import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

export interface IdempotencyKeyParts {
  method: string;
  path: string;
  idempotencyKey: string;
}

export interface RecordInput extends IdempotencyKeyParts {
  organizationId?: string | null;
  userId?: string | null;
  requestHash: string;
  statusCode: number;
  response: unknown;
  ttlMs?: number;
}

export type IdempotencyCheck =
  | { outcome: 'new' }
  | { outcome: 'replay'; statusCode: number; response: unknown }
  | { outcome: 'conflict' };

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24h (D-008)

export function hashRequestBody(body: unknown): string {
  const serialized = body === undefined ? '' : JSON.stringify(body);
  return createHash('sha256').update(serialized).digest('hex');
}

@Injectable()
export class IdempotencyService {
  constructor(private readonly prisma: PrismaService) {}

  /** Verifica o estado de uma chave para o par (método, rota) + hash do body. */
  async check(parts: IdempotencyKeyParts, requestHash: string): Promise<IdempotencyCheck> {
    const existing = await this.prisma.idempotencyRecord.findUnique({
      where: {
        uniq_idempotency_scope: {
          method: parts.method,
          path: parts.path,
          idempotencyKey: parts.idempotencyKey,
        },
      },
    });
    if (!existing) return { outcome: 'new' };
    if (existing.requestHash !== requestHash) return { outcome: 'conflict' };
    return { outcome: 'replay', statusCode: existing.statusCode, response: existing.response };
  }

  /** Persiste a resposta produzida para uma chave (após executar o comando). */
  async remember(input: RecordInput): Promise<void> {
    const expiresAt = new Date(Date.now() + (input.ttlMs ?? DEFAULT_TTL_MS));
    await this.prisma.idempotencyRecord.create({
      data: {
        organizationId: input.organizationId ?? null,
        userId: input.userId ?? null,
        method: input.method,
        path: input.path,
        idempotencyKey: input.idempotencyKey,
        requestHash: input.requestHash,
        statusCode: input.statusCode,
        response: input.response as object,
        expiresAt,
      },
    });
  }

  /** Remove registros expirados (housekeeping; chamado por job futuro). */
  async purgeExpired(now: Date = new Date()): Promise<number> {
    const result = await this.prisma.idempotencyRecord.deleteMany({
      where: { expiresAt: { lt: now } },
    });
    return result.count;
  }
}
