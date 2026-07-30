/**
 * Arden.AS — contexto e construção de eventos de auditoria na camada de aplicação.
 * Não depende de React nem de Zustand; o ator vem da sessão (fornecida pelo hook).
 */

import type { AuditEvent, RoleKey } from '@/domain/types';
import { newId, now } from '@/lib/id';

export interface AuditContext {
  actorId: string;
  actorRole: RoleKey;
  organizationId: string;
}

export interface AuditInput {
  action: string;
  objectType: string;
  objectId: string;
  previousValue?: unknown;
  newValue?: unknown;
  justification?: string;
  relatedOperationId?: string;
  relatedExecutionId?: string;
  evidenceId?: string;
  result?: AuditEvent['result'];
}

export function buildAuditEvent(ctx: AuditContext, input: AuditInput): AuditEvent {
  return {
    id: newId('aud'),
    timestamp: now(),
    actorId: ctx.actorId,
    actorRole: ctx.actorRole,
    organizationId: ctx.organizationId,
    action: input.action,
    objectType: input.objectType,
    objectId: input.objectId,
    previousValue: input.previousValue ?? null,
    newValue: input.newValue ?? null,
    justification: input.justification,
    relatedOperationId: input.relatedOperationId,
    relatedExecutionId: input.relatedExecutionId,
    evidenceId: input.evidenceId,
    result: input.result ?? 'success',
  };
}
