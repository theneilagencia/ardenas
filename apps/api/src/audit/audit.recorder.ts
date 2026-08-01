/**
 * Arden.AS API — gravação de auditoria de operações (ARDEN-BE-003).
 *
 * Append-only. Escreve eventos DENTRO da transação do comando (recebe o cliente
 * de transação), de modo que uma falha do comando NÃO deixa auditoria de sucesso.
 * Sanitiza metadados (nunca grava token/segredo). `before`/`after` carregam o
 * estado de negócio (definição/perfil) — propósito da trilha — mas metadados
 * sensíveis são redigidos.
 */

import { Injectable } from '@nestjs/common';
import type { Prisma, AuditEvent as DbAuditEvent } from '@prisma/client';

export type AuditOutcome = 'SUCCESS' | 'DENIED' | 'FAILURE';

export interface AuditRecordInput {
  organizationId: string;
  actorUserId?: string | null;
  actorRole?: string | null;
  actorDisplayName?: string | null;
  action: string;
  resourceType: string;
  resourceId: string;
  outcome?: AuditOutcome;
  correlationId: string;
  before?: unknown;
  after?: unknown;
  metadata?: Record<string, unknown>;
}

const SENSITIVE = /(authorization|token|secret|password|cookie)/i;

function sanitize(metadata: Record<string, unknown> = {}): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(metadata)) {
    out[k] = SENSITIVE.test(k) ? '[REDACTED]' : v;
  }
  return out;
}

type AuditDb = Pick<Prisma.TransactionClient, 'auditEvent'>;

@Injectable()
export class AuditRecorder {
  /**
   * Grava um evento de auditoria usando o cliente fornecido (transação do comando
   * ou serviço base). Retorna a linha criada — usada pela publicação para devolver
   * os eventos no resultado transacional.
   */
  async record(db: AuditDb, input: AuditRecordInput): Promise<DbAuditEvent> {
    return db.auditEvent.create({
      data: {
        organizationId: input.organizationId,
        actorUserId: input.actorUserId ?? null,
        actorType: 'user',
        actorRole: input.actorRole ?? null,
        actorDisplayName: input.actorDisplayName ?? null,
        action: input.action,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        outcome: input.outcome ?? 'SUCCESS',
        correlationId: input.correlationId,
        before: (input.before ?? null) as Prisma.InputJsonValue,
        after: (input.after ?? null) as Prisma.InputJsonValue,
        metadata: sanitize(input.metadata) as Prisma.InputJsonObject,
      },
    });
  }
}
