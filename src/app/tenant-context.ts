/**
 * Arden.AS — contexto único de sessão e tenant (ARDEN-FE-002).
 *
 * ÚNICA autoridade de identidade/tenant no cliente. O provider (TenantProvider)
 * resolve a sessão pelo `SessionRepository`, deriva permissões pelo
 * `PermissionResolver` e seleciona a organização ativa em UM só ponto. Este
 * módulo expõe apenas o contexto e o hook de consumo. Nada aqui é segurança real:
 * o backend revalidará identidade, tenant e permissão.
 */

import { createContext, useContext } from 'react';
import type {
  OrganizationSummary,
  SessionContext,
  SessionStatus,
} from '@/domain/identity';
import type { Permission } from '@/domain/permissions';
import type { RoleKey } from '@/domain/types';
import type { ArdenRepositoryError } from '@/services/errors';

export interface TenantContextValue {
  session: SessionContext | null;
  status: SessionStatus;
  activeOrganization: OrganizationSummary | null;
  permissions: Permission[];
  loading: boolean;
  error: ArdenRepositoryError | null;
  switchOrganization(id: string): Promise<void>;
  refreshSession(): Promise<void>;
  signOut(): Promise<void>;
  /** Demonstração: assume um papel disponível (simulação de experiência). */
  switchProfile(role: RoleKey): void;
  can(permission: Permission): boolean;
}

export const TenantContext = createContext<TenantContextValue | null>(null);

export function useTenant(): TenantContextValue {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error('useTenant deve ser usado dentro de <TenantProvider>.');
  return ctx;
}
