/**
 * Arden.AS — TenantProvider (ARDEN-FE-002).
 *
 * Resolve a sessão pelo `SessionRepository`, espelha o mínimo necessário na store
 * (fatias não migradas) e propaga o tenant ao ApiClient. Ao trocar de organização
 * ou sair, LIMPA os caches para impedir vazamento de dados entre tenants. Grava
 * eventos LOCAIS de auditoria de sessão (provisórios) pela fronteira única.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { queryClient } from '@/lib/query-client';
import {
  activeOrganization as selectActiveOrg,
  deriveSessionStatus,
  type SessionContext,
} from '@/domain/identity';
import type { Permission } from '@/domain/permissions';
import { permissionResolver } from '@/domain/permission-resolver';
import type { RoleKey } from '@/domain/types';
import { getSessionRepository } from '@/services/service-container';
import { setActiveOrganizationId } from '@/services/session/active-context';
import { toRepositoryError } from '@/services/errors';
import { appendAuditEvent, toRequestContext } from '@/application';
import { useAppStore } from '@/store/app-store';
import { TenantContext, type TenantContextValue } from './tenant-context';

export function TenantProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<TenantContextValue['error']>(null);
  const [forcedRole, setForcedRole] = useState<RoleKey | null>(null);
  const applySessionToStore = useAppStore((s) => s.applySession);
  const resetTenantScope = useAppStore((s) => s.resetTenantScope);
  const loggedLoadRef = useRef(false);

  // Aplica a sessão resolvida: espelha na store e propaga o tenant ao ApiClient.
  const apply = useCallback(
    (next: SessionContext | null) => {
      const effective =
        next && forcedRole
          ? { ...next, permissions: permissionResolver.forRoles([forcedRole]) }
          : next;
      setSession(effective);
      setActiveOrganizationId(effective?.activeOrganizationId ?? null);
      applySessionToStore(effective);
    },
    [applySessionToStore, forcedRole],
  );

  // Carga inicial da sessão (e reaplicação quando o papel forçado muda).
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getSessionRepository()
      .getCurrentSession()
      .then((s) => {
        if (cancelled) return;
        apply(s);
        setError(null);
        if (s && !loggedLoadRef.current) {
          loggedLoadRef.current = true;
          void logSessionEvent(s, 'session.loaded', { userId: s.user.id });
        }
      })
      .catch((err) => {
        if (cancelled) return;
        apply(null);
        setError(toRepositoryError(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [apply]);

  const switchOrganization = useCallback(
    async (organizationId: string) => {
      const previous = session?.activeOrganizationId ?? null;
      if (organizationId === previous) return;
      setLoading(true);
      try {
        const next = await getSessionRepository().switchOrganization(organizationId);
        // Impede exibição de dados do tenant anterior durante a transição.
        resetTenantScope();
        queryClient.clear();
        apply(next);
        setError(null);
        await logSessionEvent(next, 'organization.switched', {
          from: previous,
          to: organizationId,
        });
      } catch (err) {
        // Mantém a organização anterior em caso de erro.
        setError(toRepositoryError(err));
        throw toRepositoryError(err);
      } finally {
        setLoading(false);
      }
    },
    [apply, resetTenantScope, session],
  );

  const refreshSession = useCallback(async () => {
    setLoading(true);
    try {
      const next = await getSessionRepository().refreshSession();
      apply(next);
      setError(null);
      await logSessionEvent(next, 'session.refreshed', { userId: next.user.id });
    } catch (err) {
      setError(toRepositoryError(err));
    } finally {
      setLoading(false);
    }
  }, [apply]);

  const signOut = useCallback(async () => {
    const current = session;
    await getSessionRepository().signOut();
    if (current) await logSessionEvent(current, 'session.signed_out', { userId: current.user.id });
    resetTenantScope();
    queryClient.clear();
    apply(null);
  }, [apply, resetTenantScope, session]);

  const switchProfile = useCallback((role: RoleKey) => {
    // Simulação de experiência: o efeito de carga reaplica a sessão com o papel
    // forçado. Não é troca de identidade real.
    setForcedRole(role);
  }, []);

  const permissions = useMemo<Permission[]>(() => session?.permissions ?? [], [session]);
  const can = useCallback(
    (permission: Permission) => permissionResolver.can(permissions, permission),
    [permissions],
  );

  const status = deriveSessionStatus({ session, loading, error });

  const value = useMemo<TenantContextValue>(
    () => ({
      session,
      status,
      activeOrganization: selectActiveOrg(session),
      permissions,
      loading,
      error,
      switchOrganization,
      refreshSession,
      signOut,
      switchProfile,
      can,
    }),
    [
      session,
      status,
      permissions,
      loading,
      error,
      switchOrganization,
      refreshSession,
      signOut,
      switchProfile,
      can,
    ],
  );

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

/** Grava um evento de auditoria de sessão (local, provisório) sem quebrar o fluxo. */
async function logSessionEvent(
  session: SessionContext,
  action: string,
  newValue: Record<string, unknown>,
): Promise<void> {
  const ctx = toRequestContext(session);
  if (!ctx) return;
  try {
    await appendAuditEvent(ctx, {
      action,
      objectType: 'Session',
      objectId: session.user.id,
      newValue,
    });
    useAppStore.getState().bumpAuditVersion();
  } catch {
    /* auditoria de sessão é best-effort nesta simulação */
  }
}
