import type { Operation } from '@/domain/types';
import { getServices } from '@/services/service-container';
import { toRepositoryError } from '@/services/errors';
import { buildAuditEvent, type AuditContext } from '../audit/audit-context';

/** Comando explícito: prepara uma versão candidata a partir do rascunho atual. */
export async function createOperationVersion(id: string, ctx: AuditContext): Promise<Operation> {
  try {
    const op = await getServices().operations.createVersion(id);
    await getServices().audit.append(
      buildAuditEvent(ctx, {
        action: 'operation.version_created',
        objectType: 'Operation',
        objectId: id,
        newValue: { version: op.version },
        relatedOperationId: id,
      }),
    );
    return op;
  } catch (err) {
    throw toRepositoryError(err);
  }
}
