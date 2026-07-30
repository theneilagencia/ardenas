/**
 * Arden.AS — OperationsRepository ligado à store (modos mock/indexeddb).
 * Mesma interface do contrato; os componentes não sabem qual implementação está
 * ativa. A store é a fonte da verdade offline e persiste via provider.
 */

import type { OperationQuery, OperationsRepository, PaginatedResult } from '../contracts';
import type { Execution, Operation } from '@/domain/types';
import { useAppStore } from '@/store/app-store';

export class StoreOperationsRepository implements OperationsRepository {
  private get store() {
    return useAppStore.getState();
  }

  async list(params?: OperationQuery): Promise<PaginatedResult<Operation>> {
    const { data, organizationId } = this.store;
    let items = data.operations.filter((o) => o.organizationId === organizationId);
    if (params?.status) items = items.filter((o) => o.status === params.status);
    if (params?.search) {
      const q = params.search.toLowerCase();
      items = items.filter((o) => o.name.toLowerCase().includes(q));
    }
    return { items, page: 1, pageSize: items.length, total: items.length };
  }

  async getById(id: string): Promise<Operation> {
    const op = this.store.data.operations.find((o) => o.id === id);
    if (!op) throw new Error(`Operação ${id} não encontrada`);
    return op;
  }

  async create(input: Operation): Promise<Operation> {
    this.store.saveDraft(input);
    return this.getById(input.id);
  }

  async update(id: string, input: Partial<Operation>): Promise<Operation> {
    const current = await this.getById(id);
    this.store.saveDraft({ ...current, ...input, id });
    return this.getById(id);
  }

  async publish(id: string): Promise<Operation> {
    const op = await this.getById(id);
    return this.store.publishOperation(op);
  }

  async pause(id: string): Promise<Operation> {
    this.store.pauseOperation(id);
    return this.getById(id);
  }

  async resume(id: string): Promise<Operation> {
    this.store.resumeOperation(id);
    return this.getById(id);
  }

  async createExecution(id: string, opts?: { test: boolean }): Promise<Execution> {
    return this.store.startExecution(id, opts);
  }

  async archive(id: string): Promise<void> {
    this.store.archiveOperation(id);
  }
}
