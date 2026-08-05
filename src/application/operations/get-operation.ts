import type { Operation } from '@/domain/types';
import { getServices } from '@/services/service-container';
import { ArdenRepositoryError, toRepositoryError } from '@/services/errors';
import { assertPermission, type RequestContext } from '../request-context';

export async function getOperation(
  ctx: RequestContext,
  id: string,
  signal?: AbortSignal,
): Promise<Operation> {
  assertPermission(ctx, 'operation.view');
  try {
    const op = await getServices().operations.getById(id, signal);
    // Isolamento de tenant: uma operação de outra organização não é visível.
    if (op.organizationId !== ctx.organizationId) {
      throw new ArdenRepositoryError('NOT_FOUND', `Operação ${id} não encontrada`);
    }
    return op;
  } catch (err) {
    throw toRepositoryError(err);
  }
}
