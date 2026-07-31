/**
 * Arden.AS — contexto de requisição (ARDEN-FE-002).
 *
 * Todo caso de uso que depende de organização recebe um `RequestContext`
 * DERIVADO DA SESSÃO ATIVA. O `organizationId` nunca é digitado num formulário
 * nem informado arbitrariamente pelo usuário: vem sempre da sessão. As
 * `permissions` são a defesa de EXPERIÊNCIA da interface — o backend revalida.
 */

import type { Permission } from '@/domain/permissions';
import type { RoleKey } from '@/domain/types';
import { activeMembership, type SessionContext } from '@/domain/identity';
import { newId } from '@/lib/id';
import { ArdenRepositoryError } from '@/services/errors';

export interface RequestContext {
  userId: string;
  organizationId: string;
  correlationId: string;
  /** Papel dominante do ator no tenant ativo (para trilha de auditoria). */
  actorRole: RoleKey;
  /** Permissões efetivas no tenant ativo (ergonomia; não é segurança real). */
  permissions: Permission[];
}

export function newCorrelationId(): string {
  return newId('req');
}

/**
 * Deriva o `RequestContext` da sessão ativa. Retorna `null` quando não há tenant
 * ativo. O `organizationId` vem SEMPRE daqui — nunca de um formulário.
 */
export function toRequestContext(session: SessionContext | null): RequestContext | null {
  if (!session || !session.activeOrganizationId) return null;
  const membership = activeMembership(session);
  return {
    userId: session.user.id,
    organizationId: session.activeOrganizationId,
    correlationId: newCorrelationId(),
    actorRole: membership?.roleIds[0] ?? 'analyst',
    permissions: session.permissions,
  };
}

/**
 * Defesa local de autorização (UX). Lança `FORBIDDEN` quando a permissão não está
 * presente no contexto. Isto NÃO substitui a autorização de servidor — apenas
 * evita que a interface dispare uma ação que o usuário claramente não pode fazer.
 * O backend deverá repetir esta checagem de forma autoritativa.
 */
export function assertPermission(ctx: RequestContext, permission: Permission): void {
  if (!ctx.permissions.includes(permission)) {
    throw new ArdenRepositoryError(
      'FORBIDDEN',
      `Ação não permitida para o contexto atual (${permission}).`,
    );
  }
}
