/**
 * Arden.AS — afordância de SIMULAÇÃO de estados de sessão (ARDEN-FE-002).
 *
 * Toda a sessão é simulada nesta etapa (não há login real). Para demonstrar e
 * testar os estados distintos (expirada, sem organização, suspensa, não
 * autenticada, papel específico), o provedor local lê um cenário de simulação de
 * `?sim=` na URL ou de `sessionStorage`. EM PRODUÇÃO estes estados serão
 * originados/validados pelo BACKEND — esta é apenas uma ponte de demonstração.
 */

import type { SessionContext } from '@/domain/identity';

export type SessionSimulation =
  | { kind: 'none' }
  | { kind: 'unauthenticated' }
  | { kind: 'expired' }
  | { kind: 'suspended' }
  | { kind: 'no_org' }
  | { kind: 'role'; role: string };

const KEY = 'arden.session.sim';

export function parseSimulation(raw: string | null | undefined): SessionSimulation {
  if (!raw) return { kind: 'none' };
  if (raw === 'unauthenticated') return { kind: 'unauthenticated' };
  if (raw === 'expired') return { kind: 'expired' };
  if (raw === 'suspended') return { kind: 'suspended' };
  if (raw === 'no_org') return { kind: 'no_org' };
  if (raw.startsWith('role:')) return { kind: 'role', role: raw.slice('role:'.length) };
  return { kind: 'none' };
}

/** Lê o cenário atual de URL/sessionStorage (persistindo o da URL). */
export function readSimulation(): SessionSimulation {
  if (typeof window === 'undefined') return { kind: 'none' };
  try {
    const fromUrl = new URLSearchParams(window.location.search).get('sim');
    if (fromUrl) {
      window.sessionStorage.setItem(KEY, fromUrl);
      return parseSimulation(fromUrl);
    }
    return parseSimulation(window.sessionStorage.getItem(KEY));
  } catch {
    return { kind: 'none' };
  }
}

/** `forceRole` aplicável na derivação (papel efetivo da membership ativa). */
export function simulationForceRole(sim: SessionSimulation): string | undefined {
  return sim.kind === 'role' ? sim.role : undefined;
}

/** Aplica o cenário sobre uma sessão já derivada (retorna null se não autenticada). */
export function applySimulation(
  session: SessionContext | null,
  sim: SessionSimulation,
): SessionContext | null {
  if (!session) return session;
  switch (sim.kind) {
    case 'unauthenticated':
      return null;
    case 'expired':
      return { ...session, expiresAt: new Date(Date.now() - 60_000).toISOString() };
    case 'suspended':
      return { ...session, user: { ...session.user, status: 'suspended' } };
    case 'no_org':
      return { ...session, memberships: [], organizations: [], activeOrganizationId: null };
    default:
      return session;
  }
}
