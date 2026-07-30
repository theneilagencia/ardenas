/**
 * Arden.AS — FilesRepository sobre o SnapshotStore.
 * Disponível para mock/indexeddb; a UI de arquivos ainda usa a store (Fase 3).
 */

import type { FilesRepository } from '../contracts';
import type { ManagedFile } from '@/domain/types';
import type { SnapshotStore } from '../data/snapshot-store';
import { ArdenRepositoryError } from '../errors';
import { now } from '@/lib/id';

export class SnapshotFilesRepository implements FilesRepository {
  constructor(private readonly store: SnapshotStore) {}

  async candidates(): Promise<ManagedFile[]> {
    return (await this.store.read()).files;
  }

  private async mutate(id: string, fn: (f: ManagedFile) => ManagedFile): Promise<ManagedFile> {
    let updated: ManagedFile | null = null;
    await this.store.update((s) => {
      const exists = s.files.find((f) => f.id === id);
      if (!exists) throw new ArdenRepositoryError('NOT_FOUND', `Arquivo ${id} não encontrado`);
      const files = s.files.map((f) => {
        if (f.id !== id) return f;
        updated = fn(f);
        return updated;
      });
      return { ...s, files };
    });
    return updated!;
  }

  quarantine(id: string) {
    return this.mutate(id, (f) => ({
      ...f,
      state: 'quarantined',
      quarantinedAt: now(),
      recoverableUntil: new Date(Date.now() + 30 * 86_400_000).toISOString(),
    }));
  }

  restore(id: string) {
    return this.mutate(id, (f) => ({ ...f, state: 'active', quarantinedAt: undefined }));
  }

  requestDeletion(id: string, approverId: string) {
    return this.mutate(id, (f) => ({
      ...f,
      state: 'deletion_requested',
      deletionApprovers: [approverId],
    }));
  }

  approveDeletion(id: string, approverId: string) {
    return this.mutate(id, (f) => {
      const approvers = f.deletionApprovers.includes(approverId)
        ? f.deletionApprovers
        : [...f.deletionApprovers, approverId];
      const twoApprovers = new Set(approvers).size >= 2;
      return { ...f, deletionApprovers: approvers, state: twoApprovers ? 'deleted' : 'deletion_requested' };
    });
  }
}
