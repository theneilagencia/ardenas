import type { AuditEvent } from '@/domain/types';
import { getServices } from '@/services/service-container';
import { toRepositoryError } from '@/services/errors';
import type { AuditQuery } from '@/services/contracts';

export async function listAuditEvents(input: AuditQuery): Promise<AuditEvent[]> {
  try {
    return await getServices().audit.list(input);
  } catch (err) {
    throw toRepositoryError(err);
  }
}
