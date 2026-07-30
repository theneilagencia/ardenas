import type { Operation } from '@/domain/types';
import { getServices } from '@/services/service-container';
import { toRepositoryError } from '@/services/errors';
import { buildAuditEvent, type AuditContext } from '../audit/audit-context';

/** Comando explícito de publicação — não é atualização de campo. */
export async function publishOperationVersion(id: string, ctx: AuditContext): Promise<Operation> {
  try {
    const op = await getServices().operations.publishVersion(id);
    await getServices().audit.append(
      buildAuditEvent(ctx, {
        action: 'operation.publish',
        objectType: 'Operation',
        objectId: op.id,
        previousValue: { status: 'draft' },
        newValue: { status: op.status, version: op.version },
        relatedOperationId: op.id,
      }),
    );
    return op;
  } catch (err) {
    throw toRepositoryError(err);
  }
}
