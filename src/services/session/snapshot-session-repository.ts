/**
 * Arden.AS — SessionRepository sobre o SnapshotStore (modos mock/indexeddb).
 *
 * Deriva a sessão do domínio (pessoas/organizações) e persiste apenas a seleção
 * (usuário/organização ativos) via `SessionSelectionStore`. Simula uma sessão já
 * autenticada — não há login nesta etapa. A troca de organização VALIDA a
 * membership ativa antes de efetivar; sem fallback silencioso.
 */

import type { SessionContext } from '@/domain/identity';
import type { SnapshotStore } from '../data/snapshot-store';
import { ArdenRepositoryError } from '../errors';
import type { SessionRepository, SessionSelectionStore } from './session-contracts';
import {
  buildSessionContext,
  defaultPerson,
  stableUserId,
} from './session-derivation';
import {
  applySimulation,
  readSimulation,
  simulationForceRole,
  type SessionSimulation,
} from './simulation';

/** Duração simulada da sessão: 8 horas a partir da autenticação. */
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

export class SnapshotSessionRepository implements SessionRepository {
  constructor(
    private readonly store: SnapshotStore,
    private readonly selection: SessionSelectionStore,
    private readonly readSim: () => SessionSimulation = readSimulation,
  ) {}

  async getCurrentSession(): Promise<SessionContext | null> {
    const sel = await this.selection.read();
    if (sel.signedOut) return null;

    const snapshot = await this.store.read();

    // Primeira vez (sem seleção): "autentica" o usuário padrão e persiste.
    let currentUserId = sel.currentUserId;
    let expiresAt = sel.expiresAt;
    if (!currentUserId) {
      const anchor = defaultPerson(snapshot.people);
      if (!anchor) return null;
      currentUserId = stableUserId(anchor.email);
      expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
      await this.selection.write({
        currentUserId,
        activeOrganizationId: sel.activeOrganizationId,
        signedOut: false,
        expiresAt,
      });
    }

    const sim = this.readSim();
    const session = buildSessionContext({
      snapshot,
      currentUserId,
      activeOrganizationId: sel.activeOrganizationId,
      expiresAt,
      forceRole: simulationForceRole(sim),
    });

    // Persiste a organização ativa resolvida (quando não havia seleção prévia).
    if (session && session.activeOrganizationId && session.activeOrganizationId !== sel.activeOrganizationId) {
      await this.selection.write({
        currentUserId,
        activeOrganizationId: session.activeOrganizationId,
        signedOut: false,
        expiresAt,
      });
    }

    return applySimulation(session, sim);
  }

  async switchOrganization(organizationId: string): Promise<SessionContext> {
    const current = await this.getCurrentSession();
    if (!current) {
      throw new ArdenRepositoryError('UNAUTHORIZED', 'Sessão ausente.');
    }
    // Valida membership ATIVA no destino — o usuário não escolhe tenant arbitrário.
    const membership = current.memberships.find((m) => m.organizationId === organizationId);
    if (!membership || membership.status !== 'active') {
      throw new ArdenRepositoryError(
        'FORBIDDEN',
        'Sem membership ativa na organização selecionada.',
      );
    }
    const sel = await this.selection.read();
    await this.selection.write({
      currentUserId: sel.currentUserId,
      activeOrganizationId: organizationId,
      signedOut: false,
      expiresAt: sel.expiresAt,
    });
    const next = await this.getCurrentSession();
    if (!next) throw new ArdenRepositoryError('UNKNOWN', 'Falha ao recarregar a sessão.');
    return next;
  }

  async refreshSession(): Promise<SessionContext> {
    const sel = await this.selection.read();
    if (!sel.signedOut && sel.currentUserId) {
      // Renova a expiração simulada.
      await this.selection.write({
        ...sel,
        expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
      });
    }
    const next = await this.getCurrentSession();
    if (!next) throw new ArdenRepositoryError('UNAUTHORIZED', 'Sessão ausente.');
    return next;
  }

  async signOut(): Promise<void> {
    const sel = await this.selection.read();
    await this.selection.write({
      currentUserId: null,
      activeOrganizationId: null,
      signedOut: true,
      expiresAt: null,
    });
    void sel;
  }
}
