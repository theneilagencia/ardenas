/**
 * Arden.AS — modelo de identidade, sessão e tenant (ARDEN-FE-002).
 *
 * Estes tipos descrevem o que o frontend PRECISA saber para exibir a experiência
 * correta: quem está autenticado, de quais organizações participa, qual está ativa
 * e quais permissões o backend futuramente confirmará. A implementação atual é
 * local/simulada — a AUTORIDADE final sobre identidade, papel, tenant e permissão
 * será sempre do servidor. Esconder um botão nunca protege uma ação.
 */

import type { Permission } from './permissions';
import type { RoleKey } from './types';

/** Usuário autenticado (identidade estável entre organizações). */
export interface AuthenticatedUser {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  status: 'active' | 'suspended';
}

/** Resumo de organização visível na troca de tenant. */
export interface OrganizationSummary {
  id: string;
  name: string;
  slug: string;
  status: 'active' | 'suspended';
}

/** Vínculo do usuário com uma organização (papéis por tenant). */
export interface Membership {
  id: string;
  userId: string;
  organizationId: string;
  roleIds: RoleKey[];
  status: 'active' | 'invited' | 'suspended';
}

/**
 * Contexto de sessão resolvido pelo `SessionRepository`. É a única fonte da
 * identidade/tenant no cliente. `permissions` é ergonomia de interface; o backend
 * revalida cada ação.
 */
export interface SessionContext {
  user: AuthenticatedUser;
  organizations: OrganizationSummary[];
  memberships: Membership[];
  activeOrganizationId: string | null;
  permissions: Permission[];
  /** Expiração simulada da sessão (ISO). `null` = sem expiração conhecida. */
  expiresAt: string | null;
}

/**
 * Estados distintos que a aplicação precisa distinguir visualmente. `forbidden`
 * é resolvido por rota (PermissionBoundary); os demais são de sessão/tenant.
 */
export type SessionStatus =
  | 'loading'
  | 'authenticated'
  | 'unauthenticated'
  | 'expired'
  | 'forbidden'
  | 'no_organization'
  | 'suspended'
  | 'error';

/** Membership ativa (do tenant selecionado), se houver. */
export function activeMembership(session: SessionContext | null): Membership | null {
  if (!session || !session.activeOrganizationId) return null;
  return (
    session.memberships.find((m) => m.organizationId === session.activeOrganizationId) ?? null
  );
}

/** Organização ativa (resumo), se houver. */
export function activeOrganization(session: SessionContext | null): OrganizationSummary | null {
  if (!session || !session.activeOrganizationId) return null;
  return session.organizations.find((o) => o.id === session.activeOrganizationId) ?? null;
}

/** Sessão expirada? */
export function isSessionExpired(session: SessionContext | null, at: number = Date.now()): boolean {
  if (!session?.expiresAt) return false;
  return new Date(session.expiresAt).getTime() <= at;
}

export interface DeriveStatusInput {
  session: SessionContext | null;
  loading: boolean;
  error: unknown;
  at?: number;
}

/**
 * Deriva o estado de sessão a partir de um único ponto. Não decide `forbidden`
 * (isso é responsabilidade da PermissionBoundary por rota).
 */
export function deriveSessionStatus({
  session,
  loading,
  error,
  at = Date.now(),
}: DeriveStatusInput): SessionStatus {
  if (loading) return 'loading';
  if (error) return 'error';
  if (!session) return 'unauthenticated';
  if (isSessionExpired(session, at)) return 'expired';
  if (session.user.status === 'suspended') return 'suspended';
  const membership = activeMembership(session);
  if (membership?.status === 'suspended') return 'suspended';
  if (session.memberships.filter((m) => m.status === 'active').length === 0) return 'no_organization';
  if (!session.activeOrganizationId || !membership) return 'no_organization';
  return 'authenticated';
}
