import type { Operation } from '@/domain/types';
import type { ListOperationsInput, PaginatedResult } from '@/services/contracts';
import { getServices } from '@/services/service-container';
import { toRepositoryError, assertValid } from '@/services/errors';

export async function listOperations(
  input: ListOperationsInput,
): Promise<PaginatedResult<Operation>> {
  assertValid(input.organizationId, 'Organização é obrigatória', 'organizationId');
  try {
    return await getServices().operations.list(input);
  } catch (err) {
    throw toRepositoryError(err);
  }
}
