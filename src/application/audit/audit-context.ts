/**
 * Arden.AS — construção de eventos de auditoria na camada de aplicação.
 * Não depende de React nem de Zustand; o ator e o tenant vêm do RequestContext
 * (derivado da sessão ativa). A escrita passa pela fronteira única
 * `AuditRepository.append` — ver `appendAuditEvent`.
 */

import type { AuditEvent } from '@/domain/types';
import { newId, now } from '@/lib/id';
import { getServices } from '@/services/service-container';
import { toRepositoryError } from '@/services/errors';
import type { RequestContext } from '../request-context';

/**
 * Contexto mínimo para gravar auditoria. `RequestContext` é um superconjunto e
 * pode ser usado diretamente onde um `AuditContext` é esperado.
 */
export interface AuditContext {
  userId: string;
  actorRole: RequestContext['actorRole'];
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
    actorId: ctx.userId,
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

/**
 * Fronteira única de escrita de auditoria: constrói o evento a partir do
 * contexto e o grava pelo repositório. Erros são normalizados.
 */
export async function appendAuditEvent(ctx: AuditContext, input: AuditInput): Promise<AuditEvent> {
  try {
    return await getServices().audit.append(buildAuditEvent(ctx, input));
  } catch (err) {
    throw toRepositoryError(err);
  }
}
