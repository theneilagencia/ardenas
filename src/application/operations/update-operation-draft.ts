import type { Operation } from '@/domain/types';
import type { UpdateOperationDraftInput } from '@/services/contracts';
import { getServices } from '@/services/service-container';
import { ArdenRepositoryError, toRepositoryError } from '@/services/errors';
import { buildAuditEvent, type AuditContext } from '../audit/audit-context';

export async function updateOperationDraft(
  id: string,
  input: UpdateOperationDraftInput,
  ctx: AuditContext,
): Promise<Operation> {
  try {
    const op = await getServices().operations.updateDraft(id, input);
    await getServices().audit.append(
      buildAuditEvent(ctx, {
        action: 'operation.draft_saved',
        objectType: 'Operation',
        objectId: id,
        newValue: { status: op.status },
        relatedOperationId: id,
      }),
    );
    return op;
  } catch (err) {
    throw toRepositoryError(err);
  }
}

/**
 * Upsert de rascunho: cria se não existe, atualiza caso contrário. Usado pelo
 * wizard (rascunho retomável por id estável).
 */
export async function saveOperationDraft(
  operation: Operation,
  ctx: AuditContext,
): Promise<Operation> {
  const services = getServices();
  try {
    await services.operations.getById(operation.id);
    return updateOperationDraft(operation.id, operation, ctx);
  } catch (err) {
    const repoErr = toRepositoryError(err);
    if (repoErr.code === 'NOT_FOUND') {
      const created = await services.operations.create(operation);
      await services.audit.append(
        buildAuditEvent(ctx, {
          action: 'operation.draft_saved',
          objectType: 'Operation',
          objectId: created.id,
          newValue: { status: 'draft' },
          relatedOperationId: created.id,
        }),
      );
      return created;
    }
    throw repoErr instanceof ArdenRepositoryError ? repoErr : toRepositoryError(err);
  }
}
