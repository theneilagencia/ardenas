import type { Operation } from '@/domain/types';
import { getServices } from '@/services/service-container';
import { toRepositoryError } from '@/services/errors';
import { appendAuditEvent } from '../audit/audit-context';
import { assertPermission, type RequestContext } from '../request-context';

/** Comando explícito de publicação — não é atualização de campo. */
export async function publishOperationVersion(
  ctx: RequestContext,
  id: string,
): Promise<Operation> {
  // Defesa local de UX: publicar exige operation.publish. O backend revalidará.
  assertPermission(ctx, 'operation.publish');
  try {
    const op = await getServices().operations.publishVersion(id);
    await appendAuditEvent(ctx, {
      action: 'operation.publish',
      objectType: 'Operation',
      objectId: op.id,
      previousValue: { status: 'draft' },
      newValue: { status: op.status, version: op.version },
      relatedOperationId: op.id,
    });
    return op;
  } catch (err) {
    throw toRepositoryError(err);
  }
}
