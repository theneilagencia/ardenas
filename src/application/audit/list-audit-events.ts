import type { AuditEvent } from '@/domain/types';
import { getServices } from '@/services/service-container';
import { toRepositoryError, assertValid } from '@/services/errors';
import { assertPermission, type RequestContext } from '../request-context';

export interface AuditEventsQuery {
  result?: AuditEvent['result'];
  signal?: AbortSignal;
}

export async function listAuditEvents(
  ctx: RequestContext,
  query: AuditEventsQuery = {},
): Promise<AuditEvent[]> {
  assertValid(ctx.organizationId, 'Organização é obrigatória', 'organizationId');
  assertPermission(ctx, 'audit.view');
  try {
    return await getServices().audit.list({
      organizationId: ctx.organizationId,
      result: query.result,
      signal: query.signal,
    });
  } catch (err) {
    throw toRepositoryError(err);
  }
}
