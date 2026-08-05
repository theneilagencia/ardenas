/**
 * Arden.AS — FilesRepository sobre HTTP (modo api).
 * Endpoints em docs/handoff/API_CONTRACTS.md.
 */

import type { ApiClient } from '../api-client';
import type { FilesRepository } from '../contracts';
import type { ManagedFile } from '@/domain/types';

export class ApiFilesRepository implements FilesRepository {
  constructor(private readonly client: ApiClient) {}

  async candidates(signal?: AbortSignal): Promise<ManagedFile[]> {
    const res = await this.client.get<ManagedFile[]>('/files/candidates', signal);
    return Array.isArray(res.data) ? res.data : [];
  }

  async quarantine(id: string): Promise<ManagedFile> {
    const res = await this.client.post<ManagedFile>(`/files/${id}/quarantine`);
    return res.data;
  }

  async restore(id: string): Promise<ManagedFile> {
    const res = await this.client.post<ManagedFile>(`/files/${id}/restore`);
    return res.data;
  }

  async requestDeletion(id: string, approverId: string): Promise<ManagedFile> {
    const res = await this.client.post<ManagedFile>(`/files/${id}/request-deletion`, { approverId });
    return res.data;
  }

  async approveDeletion(id: string, approverId: string): Promise<ManagedFile> {
    const res = await this.client.post<ManagedFile>(`/files/${id}/approve-deletion`, { approverId });
    return res.data;
  }
}
