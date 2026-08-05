/**
 * Arden.AS — persistência da seleção de sessão (ARDEN-FE-002).
 * Memória (mock/testes) e IndexedDB (demonstração). Guarda apenas
 * usuário/organização ativos e o marcador de sign-out — nunca credenciais.
 */

import { db } from '../db';
import type { SessionSelection, SessionSelectionStore } from './session-contracts';

export const EMPTY_SELECTION: SessionSelection = {
  currentUserId: null,
  activeOrganizationId: null,
  signedOut: false,
  expiresAt: null,
};

export class MemorySessionSelectionStore implements SessionSelectionStore {
  private selection: SessionSelection;

  constructor(initial: Partial<SessionSelection> = {}) {
    this.selection = { ...EMPTY_SELECTION, ...initial };
  }

  async read(): Promise<SessionSelection> {
    return { ...this.selection };
  }

  async write(next: SessionSelection): Promise<void> {
    this.selection = { ...next };
  }

  async clear(): Promise<void> {
    this.selection = { ...EMPTY_SELECTION };
  }
}

export class IndexedDbSessionSelectionStore implements SessionSelectionStore {
  async read(): Promise<SessionSelection> {
    const row = await db.sessionState.get('current');
    if (!row) return { ...EMPTY_SELECTION };
    return {
      currentUserId: row.currentUserId,
      activeOrganizationId: row.activeOrganizationId,
      signedOut: row.signedOut,
      expiresAt: row.expiresAt,
    };
  }

  async write(next: SessionSelection): Promise<void> {
    await db.sessionState.put({ id: 'current', ...next });
  }

  async clear(): Promise<void> {
    await db.sessionState.delete('current');
  }
}
