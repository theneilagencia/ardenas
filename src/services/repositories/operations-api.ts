/**
 * Arden.AS — OperationsRepository sobre HTTP (modo api).
 * Implementa o contrato de docs/handoff/API_CONTRACTS.md. Erros são normalizados
 * para ArdenRepositoryError.
 */

import type { ApiClient } from '../api-client';
import type {
  CreateFromAssessmentInput,
  CreateOperationInput,
  ListOperationsInput,
  OperationsRepository,
  PaginatedResult,
  UpdateOperationDraftInput,
} from '../contracts';
import type { Operation } from '@/domain/types';
import { toRepositoryError } from '../errors';

export class ApiOperationsRepository implements OperationsRepository {
  constructor(private readonly client: ApiClient) {}

  private async run<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (err) {
      throw toRepositoryError(err);
    }
  }

  list(input: ListOperationsInput): Promise<PaginatedResult<Operation>> {
    return this.run(async () => {
      const qs = new URLSearchParams();
      qs.set('organizationId', input.organizationId);
      if (input.status && input.status !== 'all') qs.set('status', input.status);
      if (input.search) qs.set('search', input.search);
      if (input.page) qs.set('page', String(input.page));
      if (input.pageSize) qs.set('pageSize', String(input.pageSize));
      const res = await this.client.get<Operation[]>(`/operations?${qs.toString()}`, input.signal);
      const items = Array.isArray(res.data) ? res.data : [];
      return {
        items,
        page: res.meta?.page ?? 1,
        pageSize: res.meta?.pageSize ?? items.length,
        total: res.meta?.total ?? items.length,
      };
    });
  }

  getById(id: string, signal?: AbortSignal): Promise<Operation> {
    return this.run(async () => (await this.client.get<Operation>(`/operations/${id}`, signal)).data);
  }

  create(input: CreateOperationInput): Promise<Operation> {
    return this.run(async () => (await this.client.post<Operation>('/operations', input)).data);
  }

  updateDraft(id: string, input: UpdateOperationDraftInput): Promise<Operation> {
    return this.run(async () => (await this.client.patch<Operation>(`/operations/${id}`, input)).data);
  }

  createVersion(id: string): Promise<Operation> {
    return this.run(
      async () => (await this.client.post<Operation>(`/operations/${id}/versions`)).data,
    );
  }

  publishVersion(id: string): Promise<Operation> {
    return this.run(
      async () => (await this.client.post<Operation>(`/operations/${id}/publish`)).data,
    );
  }

  pause(id: string): Promise<Operation> {
    return this.run(async () => (await this.client.post<Operation>(`/operations/${id}/pause`)).data);
  }

  resume(id: string): Promise<Operation> {
    return this.run(
      async () => (await this.client.post<Operation>(`/operations/${id}/resume`)).data,
    );
  }

  async archive(id: string): Promise<void> {
    await this.run(() => this.client.patch<Operation>(`/operations/${id}`, { status: 'archived' }));
  }

  duplicate(id: string): Promise<Operation> {
    return this.run(
      async () => (await this.client.post<Operation>(`/operations/${id}/duplicate`)).data,
    );
  }

  createFromAssessment(input: CreateFromAssessmentInput): Promise<Operation> {
    return this.run(
      async () =>
        (await this.client.post<Operation>('/operations/from-assessment', input)).data,
    );
  }
}
