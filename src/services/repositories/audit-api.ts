/**
 * Arden.AS — AuditRepository sobre HTTP (modo api).
 */

import type { ApiClient } from '../api-client';
import type { AuditQuery, AuditRepository } from '../contracts';
import type { AuditEvent } from '@/domain/types';
import { toRepositoryError } from '../errors';

export class ApiAuditRepository implements AuditRepository {
  constructor(private readonly client: ApiClient) {}

  async list(input: AuditQuery): Promise<AuditEvent[]> {
    try {
      const qs = new URLSearchParams({ organizationId: input.organizationId });
      if (input.result) qs.set('result', input.result);
      const res = await this.client.get<AuditEvent[]>(`/audit-events?${qs.toString()}`, input.signal);
      return Array.isArray(res.data) ? res.data : [];
    } catch (err) {
      throw toRepositoryError(err);
    }
  }

  async append(event: AuditEvent): Promise<AuditEvent> {
    try {
      const res = await this.client.post<AuditEvent>('/audit-events', event);
      return res.data ?? event;
    } catch (err) {
      throw toRepositoryError(err);
    }
  }
}
