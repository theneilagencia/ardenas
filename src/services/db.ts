/**
 * Arden.AS — persistência local (IndexedDB via Dexie).
 * Guarda o snapshot do domínio para funcionamento offline como PWA.
 */

import Dexie, { type Table } from 'dexie';
import type { DomainSnapshot } from './contracts';

interface SnapshotRow {
  id: 'current';
  snapshot: DomainSnapshot;
  savedAt: string;
}

export class ArdenDb extends Dexie {
  snapshots!: Table<SnapshotRow, string>;

  constructor() {
    super('arden-as');
    this.version(1).stores({
      snapshots: 'id',
    });
  }
}

export const db = new ArdenDb();
