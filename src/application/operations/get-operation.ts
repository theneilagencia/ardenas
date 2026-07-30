import type { Operation } from '@/domain/types';
import { getServices } from '@/services/service-container';
import { toRepositoryError } from '@/services/errors';

export async function getOperation(id: string, signal?: AbortSignal): Promise<Operation> {
  try {
    return await getServices().operations.getById(id, signal);
  } catch (err) {
    throw toRepositoryError(err);
  }
}
