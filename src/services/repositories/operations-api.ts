/**
 * Arden.AS — OperationsRepository sobre HTTP (modo api).
 * Implementa o contrato de docs/handoff/API_CONTRACTS.md. Todo método aceita
 * AbortSignal opcional; erros passam pelo mapa de tratamento do ApiClient.
 */

import type { ApiClient } from '../api-client';
import type { OperationQuery, OperationsRepository, PaginatedResult } from '../contracts';
import type { Execution, Operation } from '@/domain/types';

export class ApiOperationsRepository implements OperationsRepository {
  constructor(private readonly client: ApiClient) {}

  async list(params?: OperationQuery): Promise<PaginatedResult<Operation>> {
    const qs = new URLSearchParams();
    if (params?.status) qs.set('status', params.status);
    if (params?.search) qs.set('search', params.search);
    if (params?.page) qs.set('page', String(params.page));
    if (params?.pageSize) qs.set('pageSize', String(params.pageSize));
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    const res = await this.client.get<Operation[]>(`/operations${suffix}`, params?.signal);
    const items = Array.isArray(res.data) ? res.data : [];
    return {
      items,
      page: res.meta?.page ?? 1,
      pageSize: res.meta?.pageSize ?? items.length,
      total: res.meta?.total ?? items.length,
    };
  }

  async getById(id: string, signal?: AbortSignal): Promise<Operation> {
    const res = await this.client.get<Operation>(`/operations/${id}`, signal);
    return res.data;
  }

  async create(input: Operation): Promise<Operation> {
    const res = await this.client.post<Operation>('/operations', input);
    return res.data;
  }

  async update(id: string, input: Partial<Operation>): Promise<Operation> {
    const res = await this.client.patch<Operation>(`/operations/${id}`, input);
    return res.data;
  }

  async publish(id: string): Promise<Operation> {
    const res = await this.client.post<Operation>(`/operations/${id}/publish`);
    return res.data;
  }

  async pause(id: string): Promise<Operation> {
    const res = await this.client.post<Operation>(`/operations/${id}/pause`);
    return res.data;
  }

  async resume(id: string): Promise<Operation> {
    const res = await this.client.post<Operation>(`/operations/${id}/resume`);
    return res.data;
  }

  async createExecution(id: string, opts?: { test: boolean }): Promise<Execution> {
    const res = await this.client.post<Execution>(`/operations/${id}/execute`, {
      test: opts?.test ?? false,
    });
    return res.data;
  }

  async archive(id: string): Promise<void> {
    // O contrato não expõe endpoint dedicado de arquivamento; usa-se PATCH de estado.
    await this.client.patch<Operation>(`/operations/${id}`, { status: 'archived' });
  }
}
