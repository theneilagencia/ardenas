/**
 * Arden.AS — OperationsRepository sobre o SnapshotStore (modos mock/indexeddb).
 * Fonte de verdade do agregado Operação: read-modify-write da fatia `operations`.
 * Não depende de React nem da store de UI.
 */

import type {
  CreateFromAssessmentInput,
  CreateOperationInput,
  ListOperationsInput,
  OperationsRepository,
  PaginatedResult,
  UpdateOperationDraftInput,
} from '../contracts';
import type { Operation } from '@/domain/types';
import type { SnapshotStore } from '../data/snapshot-store';
import { ArdenRepositoryError } from '../errors';
import { newId, now } from '@/lib/id';

export class SnapshotOperationsRepository implements OperationsRepository {
  constructor(private readonly store: SnapshotStore) {}

  async list(input: ListOperationsInput): Promise<PaginatedResult<Operation>> {
    const snap = await this.store.read();
    let items = snap.operations.filter((o) => o.organizationId === input.organizationId);
    if (input.status && input.status !== 'all') {
      items = items.filter((o) => o.status === input.status);
    }
    if (input.search) {
      const q = input.search.toLowerCase();
      items = items.filter((o) => o.name.toLowerCase().includes(q));
    }
    const page = input.page ?? 1;
    const pageSize = input.pageSize ?? Math.max(items.length, 1);
    const start = (page - 1) * pageSize;
    return { items: items.slice(start, start + pageSize), page, pageSize, total: items.length };
  }

  async getById(id: string): Promise<Operation> {
    const snap = await this.store.read();
    const op = snap.operations.find((o) => o.id === id);
    if (!op) throw new ArdenRepositoryError('NOT_FOUND', `Operação ${id} não encontrada`);
    return op;
  }

  async create(input: CreateOperationInput): Promise<Operation> {
    const created: Operation = {
      ...structuredClone(input),
      status: input.status ?? 'draft',
      version: input.version ?? '0.1',
      publishedAt: input.publishedAt ?? null,
      createdAt: input.createdAt ?? now(),
      updatedAt: now(),
    };
    await this.store.update((s) => {
      if (s.operations.some((o) => o.id === created.id)) {
        throw new ArdenRepositoryError('CONFLICT', `Operação ${created.id} já existe`);
      }
      return { ...s, operations: [...s.operations, created] };
    });
    return created;
  }

  async updateDraft(id: string, input: UpdateOperationDraftInput): Promise<Operation> {
    let updated: Operation | null = null;
    await this.store.update((s) => {
      const exists = s.operations.find((o) => o.id === id);
      if (!exists) throw new ArdenRepositoryError('NOT_FOUND', `Operação ${id} não encontrada`);
      const operations = s.operations.map((o) => {
        if (o.id !== id) return o;
        updated = { ...o, ...input, id: o.id, updatedAt: now() };
        return updated;
      });
      return { ...s, operations };
    });
    return updated!;
  }

  async createVersion(id: string): Promise<Operation> {
    let updated: Operation | null = null;
    await this.store.update((s) => {
      const op = s.operations.find((o) => o.id === id);
      if (!op) throw new ArdenRepositoryError('NOT_FOUND', `Operação ${id} não encontrada`);
      // Comando explícito: registra o estado atual como entrada de versão candidata.
      const entry = {
        version: op.version,
        publishedAt: op.publishedAt,
        environment: op.environment,
        status: op.status,
        budget: op.budget,
        workUnits: op.workUnits,
        note: 'Versão preparada para publicação.',
      };
      const versions = op.versions ? [...op.versions, entry] : [entry];
      const operations = s.operations.map((o) => {
        if (o.id !== id) return o;
        updated = { ...o, versions, updatedAt: now() };
        return updated;
      });
      return { ...s, operations };
    });
    return updated!;
  }

  async publishVersion(id: string): Promise<Operation> {
    let updated: Operation | null = null;
    await this.store.update((s) => {
      const op = s.operations.find((o) => o.id === id);
      if (!op) throw new ArdenRepositoryError('NOT_FOUND', `Operação ${id} não encontrada`);
      const version = op.version && op.version !== '0.1' ? op.version : '1.0';
      const entry = {
        version,
        publishedAt: now(),
        environment: op.environment,
        status: 'scheduled' as const,
        budget: op.budget,
        workUnits: op.workUnits,
        note: 'Publicada.',
      };
      const versions = (op.versions ?? []).some((v) => v.version === version)
        ? (op.versions ?? [])
        : [...(op.versions ?? []), entry];
      const operations = s.operations.map((o) => {
        if (o.id !== id) return o;
        updated = {
          ...o,
          version,
          status: 'scheduled',
          publishedAt: now(),
          versions,
          updatedAt: now(),
        };
        return updated;
      });
      return { ...s, operations };
    });
    return updated!;
  }

  pause(id: string): Promise<Operation> {
    return this.setStatus(id, 'paused');
  }

  resume(id: string): Promise<Operation> {
    return this.setStatus(id, 'running');
  }

  async archive(id: string): Promise<void> {
    await this.setStatus(id, 'archived');
  }

  async duplicate(id: string): Promise<Operation> {
    const source = await this.getById(id);
    const copy: Operation = {
      ...structuredClone(source),
      id: newId('op'),
      name: `${source.name} (cópia)`,
      version: '0.1',
      status: 'draft',
      environment: null,
      publishedAt: null,
      createdAt: now(),
      updatedAt: now(),
    };
    await this.store.update((s) => ({ ...s, operations: [...s.operations, copy] }));
    return copy;
  }

  async createFromAssessment(input: CreateFromAssessmentInput): Promise<Operation> {
    const draft: Operation = {
      id: newId('op'),
      name: input.operationName,
      organizationId: input.organizationId,
      companyId: input.companyId ?? '',
      unitId: '',
      areaId: '',
      costCenterId: '',
      criticality: input.execScore >= 80 ? 'moderate' : 'elevated',
      tags: [input.discipline],
      problem: '',
      objective: '',
      expectedResult: '',
      recipients: [],
      deliverables: [],
      frequency: '',
      sla: '',
      indicators: [],
      completionCriteria: [],
      ownerId: input.responsibleId,
      approverIds: [],
      substituteIds: [],
      triggers: [],
      contextSourceIds: [],
      integrationIds: [],
      steps: [],
      actions: [],
      approvalChain: [],
      operationalLimits: [],
      budget: 0,
      workUnits: 0,
      evidencePolicy: '',
      retentionPolicy: '',
      notificationRules: [],
      environment: null,
      version: '0.1',
      status: 'draft',
      publishedAt: null,
      createdAt: now(),
      updatedAt: now(),
    };
    await this.store.update((s) => ({ ...s, operations: [...s.operations, draft] }));
    return draft;
  }

  private async setStatus(id: string, status: Operation['status']): Promise<Operation> {
    let updated: Operation | null = null;
    await this.store.update((s) => {
      const exists = s.operations.find((o) => o.id === id);
      if (!exists) throw new ArdenRepositoryError('NOT_FOUND', `Operação ${id} não encontrada`);
      const operations = s.operations.map((o) => {
        if (o.id !== id) return o;
        updated = { ...o, status, updatedAt: now() };
        return updated;
      });
      return { ...s, operations };
    });
    return updated!;
  }
}
