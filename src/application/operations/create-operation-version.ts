import type { Operation } from '@/domain/types';
import { getServices } from '@/services/service-container';
import { toRepositoryError } from '@/services/errors';
import { appendAuditEvent } from '../audit/audit-context';
import { assertPermission, type RequestContext } from '../request-context';

/** Comando explícito: prepara uma versão candidata a partir do rascunho atual. */
export async function createOperationVersion(
  ctx: RequestContext,
  id: string,
): Promise<Operation> {
  assertPermission(ctx, 'operation.edit');
  try {
    const op = await getServices().operations.createVersion(id);
    await appendAuditEvent(ctx, {
      action: 'operation.version_created',
      objectType: 'Operation',
      objectId: id,
      newValue: { version: op.version },
      relatedOperationId: id,
    });
    return op;
  } catch (err) {
    throw toRepositoryError(err);
  }
}
