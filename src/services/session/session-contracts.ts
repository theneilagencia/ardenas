/**
 * Arden.AS — contratos de sessão e tenant (ARDEN-FE-002).
 *
 * O frontend consome estas interfaces; nunca conhece a implementação concreta
 * (mock/indexeddb/api). A resolução da implementação ocorre em um só lugar
 * (service-container). Contratos específicos por responsabilidade — sem um
 * repositório genérico único.
 */

import type { Membership, OrganizationSummary, SessionContext } from '@/domain/identity';

/**
 * Fronteira de sessão. Toda mudança de identidade/tenant passa por aqui.
 * `switchOrganization` deve validar que o usuário possui membership ativa no
 * destino; caso contrário lança erro tipado.
 */
export interface SessionRepository {
  getCurrentSession(): Promise<SessionContext | null>;
  switchOrganization(organizationId: string): Promise<SessionContext>;
  refreshSession(): Promise<SessionContext>;
  signOut(): Promise<void>;
}

/** Leitura de organizações disponíveis para a sessão corrente. */
export interface OrganizationsRepository {
  listForCurrentUser(): Promise<OrganizationSummary[]>;
}

/** Leitura/validação de memberships da sessão corrente. */
export interface MembershipsRepository {
  listForCurrentUser(): Promise<Membership[]>;
  hasActiveMembership(organizationId: string): Promise<boolean>;
}

/**
 * Persistência local mínima da seleção de sessão (usuário/organização ativos).
 * NÃO guarda tokens. Existe apenas para reidratar a simulação offline.
 */
export interface SessionSelection {
  currentUserId: string | null;
  activeOrganizationId: string | null;
  signedOut: boolean;
  expiresAt: string | null;
}

export interface SessionSelectionStore {
  read(): Promise<SessionSelection>;
  write(next: SessionSelection): Promise<void>;
  clear(): Promise<void>;
}
