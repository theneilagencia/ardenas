/**
 * Arden.AS — ApprovalsRepository sobre o SnapshotStore.
 * Disponível para os modos mock/indexeddb. A UI de aprovações ainda usa a store
 * (migração da Fase 2); este repositório mantém o contrato utilizável.
 */

import type { ApprovalsRepository } from '../contracts';
import type { Approval, ApprovalState } from '@/domain/types';
import type { SnapshotStore } from '../data/snapshot-store';
import { ArdenRepositoryError } from '../errors';
import { now } from '@/lib/id';

export class SnapshotApprovalsRepository implements ApprovalsRepository {
  constructor(private readonly store: SnapshotStore) {}

  async list(): Promise<Approval[]> {
    return (await this.store.read()).approvals;
  }

  private async resolve(
    id: string,
    state: ApprovalState,
    justification?: string,
  ): Promise<Approval> {
    let updated: Approval | null = null;
    await this.store.update((s) => {
      const exists = s.approvals.find((a) => a.id === id);
      if (!exists) throw new ArdenRepositoryError('NOT_FOUND', `Aprovação ${id} não encontrada`);
      const approvals = s.approvals.map((a) => {
        if (a.id !== id) return a;
        updated = { ...a, state, resolvedAt: now(), justification };
        return updated;
      });
      return { ...s, approvals };
    });
    return updated!;
  }

  approve(id: string, justification?: string) {
    return this.resolve(id, 'approved', justification);
  }
  reject(id: string, justification?: string) {
    return this.resolve(id, 'rejected', justification);
  }
  requestChanges(id: string, justification?: string) {
    return this.resolve(id, 'changes_requested', justification);
  }
  delegate(id: string, toPersonId: string) {
    return this.resolve(id, 'delegated', `Delegado para ${toPersonId}`);
  }
}
