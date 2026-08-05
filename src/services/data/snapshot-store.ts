/**
 * Arden.AS — gateway físico de snapshot.
 * Fonte de persistência única e de baixo nível para os modos mock e indexeddb.
 * Os repositórios fazem read-modify-write da sua fatia via `update`; nenhum
 * componente conhece esta camada.
 */

import type { DomainSnapshot } from '../contracts';
import { buildSeed } from '@/domain/seed';
import { db } from '../db';

export interface SnapshotStore {
  readonly kind: 'mock' | 'indexeddb';
  read(): Promise<DomainSnapshot>;
  update(mutator: (snapshot: DomainSnapshot) => DomainSnapshot): Promise<DomainSnapshot>;
  clear(): Promise<void>;
}

/** Memória — usado em testes e no modo mock. */
export class MemorySnapshotStore implements SnapshotStore {
  readonly kind = 'mock' as const;
  private snapshot: DomainSnapshot;

  constructor(seed?: DomainSnapshot) {
    this.snapshot = seed ?? buildSeed();
  }

  async read(): Promise<DomainSnapshot> {
    return structuredClone(this.snapshot);
  }

  async update(
    mutator: (snapshot: DomainSnapshot) => DomainSnapshot,
  ): Promise<DomainSnapshot> {
    this.snapshot = mutator(structuredClone(this.snapshot));
    return structuredClone(this.snapshot);
  }

  async clear(): Promise<void> {
    this.snapshot = buildSeed();
  }
}

/** Demonstração — persiste em IndexedDB (Dexie). Semeia no primeiro uso. */
export class IndexedDbSnapshotStore implements SnapshotStore {
  readonly kind = 'indexeddb' as const;

  async read(): Promise<DomainSnapshot> {
    const row = await db.snapshots.get('current');
    if (row) return row.snapshot;
    const seed = buildSeed();
    await this.write(seed);
    return seed;
  }

  async update(
    mutator: (snapshot: DomainSnapshot) => DomainSnapshot,
  ): Promise<DomainSnapshot> {
    const current = await this.read();
    const next = mutator(current);
    await this.write(next);
    return next;
  }

  async clear(): Promise<void> {
    await db.snapshots.delete('current');
  }

  private async write(snapshot: DomainSnapshot): Promise<void> {
    await db.snapshots.put({ id: 'current', snapshot, savedAt: new Date().toISOString() });
  }
}
