/**
 * Arden.AS — ApprovalsRepository sobre HTTP (modo api).
 * Endpoints em docs/handoff/API_CONTRACTS.md.
 */

import type { ApiClient } from '../api-client';
import type { ApprovalsRepository } from '../contracts';
import type { Approval } from '@/domain/types';

export class ApiApprovalsRepository implements ApprovalsRepository {
  constructor(private readonly client: ApiClient) {}

  async list(signal?: AbortSignal): Promise<Approval[]> {
    const res = await this.client.get<Approval[]>('/approvals', signal);
    return Array.isArray(res.data) ? res.data : [];
  }

  async approve(id: string, justification?: string): Promise<Approval> {
    const res = await this.client.post<Approval>(`/approvals/${id}/approve`, { justification });
    return res.data;
  }

  async reject(id: string, justification?: string): Promise<Approval> {
    const res = await this.client.post<Approval>(`/approvals/${id}/reject`, { justification });
    return res.data;
  }

  async requestChanges(id: string, justification?: string): Promise<Approval> {
    const res = await this.client.post<Approval>(`/approvals/${id}/request-changes`, {
      justification,
    });
    return res.data;
  }

  async delegate(id: string, toPersonId: string): Promise<Approval> {
    const res = await this.client.post<Approval>(`/approvals/${id}/delegate`, { toPersonId });
    return res.data;
  }
}
