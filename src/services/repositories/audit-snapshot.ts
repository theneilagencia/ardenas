/**
 * Arden.AS — AuditRepository sobre o SnapshotStore (modos mock/indexeddb).
 * Fronteira única de escrita/leitura de eventos de auditoria.
 */

import type { AuditQuery, AuditRepository } from '../contracts';
import type { AuditEvent } from '@/domain/types';
import type { SnapshotStore } from '../data/snapshot-store';

export class SnapshotAuditRepository implements AuditRepository {
  constructor(private readonly store: SnapshotStore) {}

  async list(input: AuditQuery): Promise<AuditEvent[]> {
    const snap = await this.store.read();
    let items = snap.auditEvents.filter((e) => e.organizationId === input.organizationId);
    if (input.result) items = items.filter((e) => e.result === input.result);
    return items;
  }

  async append(event: AuditEvent): Promise<AuditEvent> {
    await this.store.update((s) => ({ ...s, auditEvents: [event, ...s.auditEvents] }));
    return event;
  }
}
