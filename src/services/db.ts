/**
 * Arden.AS — persistência local (IndexedDB via Dexie).
 * Guarda o snapshot do domínio para funcionamento offline como PWA e a seleção
 * de sessão local (usuário/organização ativos). NÃO guarda tokens reais.
 */

import Dexie, { type Table } from 'dexie';
import type { DomainSnapshot } from './contracts';

interface SnapshotRow {
  id: 'current';
  snapshot: DomainSnapshot;
  savedAt: string;
}

/**
 * Seleção de sessão simulada, persistida localmente. Guarda apenas o necessário
 * para reidratar a sessão offline: qual usuário e qual organização estavam
 * ativos, e se houve sign-out explícito. Nunca guarda credenciais.
 */
export interface SessionStateRow {
  id: 'current';
  currentUserId: string | null;
  activeOrganizationId: string | null;
  signedOut: boolean;
  expiresAt: string | null;
}

export class ArdenDb extends Dexie {
  snapshots!: Table<SnapshotRow, string>;
  sessionState!: Table<SessionStateRow, string>;

  constructor() {
    super('arden-as');
    this.version(1).stores({
      snapshots: 'id',
    });
    this.version(2).stores({
      snapshots: 'id',
      sessionState: 'id',
    });
  }
}

export const db = new ArdenDb();
