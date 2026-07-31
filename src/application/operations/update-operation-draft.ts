import type { Operation } from '@/domain/types';
import type { UpdateOperationDraftInput } from '@/services/contracts';
import { getServices } from '@/services/service-container';
import { ArdenRepositoryError, toRepositoryError } from '@/services/errors';
import { appendAuditEvent } from '../audit/audit-context';
import { assertPermission, type RequestContext } from '../request-context';

export async function updateOperationDraft(
  ctx: RequestContext,
  id: string,
  input: UpdateOperationDraftInput,
): Promise<Operation> {
  assertPermission(ctx, 'operation.edit');
  try {
    const op = await getServices().operations.updateDraft(id, input);
    await appendAuditEvent(ctx, {
      action: 'operation.draft_saved',
      objectType: 'Operation',
      objectId: id,
      newValue: { status: op.status },
      relatedOperationId: id,
    });
    return op;
  } catch (err) {
    throw toRepositoryError(err);
  }
}

/**
 * Upsert de rascunho: cria se não existe, atualiza caso contrário. Usado pelo
 * wizard (rascunho retomável por id estável). O tenant vem sempre do contexto.
 */
export async function saveOperationDraft(
  ctx: RequestContext,
  operation: Operation,
): Promise<Operation> {
  assertPermission(ctx, 'operation.create');
  const services = getServices();
  try {
    await services.operations.getById(operation.id);
    return updateOperationDraft(ctx, operation.id, { ...operation, organizationId: ctx.organizationId });
  } catch (err) {
    const repoErr = toRepositoryError(err);
    if (repoErr.code === 'NOT_FOUND') {
      const created = await services.operations.create({
        ...operation,
        organizationId: ctx.organizationId,
      });
      await appendAuditEvent(ctx, {
        action: 'operation.draft_saved',
        objectType: 'Operation',
        objectId: created.id,
        newValue: { status: 'draft' },
        relatedOperationId: created.id,
      });
      return created;
    }
    throw repoErr instanceof ArdenRepositoryError ? repoErr : toRepositoryError(err);
  }
}
