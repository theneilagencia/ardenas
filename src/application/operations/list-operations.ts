import type { Operation } from '@/domain/types';
import type { PaginatedResult } from '@/services/contracts';
import { getServices } from '@/services/service-container';
import { toRepositoryError, assertValid } from '@/services/errors';
import { assertPermission, type RequestContext } from '../request-context';

/** Filtros de listagem — o tenant NÃO vem daqui, vem do contexto (sessão). */
export interface ListOperationsQuery {
  status?: string;
  search?: string;
  page?: number;
  pageSize?: number;
  signal?: AbortSignal;
}

export async function listOperations(
  ctx: RequestContext,
  query: ListOperationsQuery = {},
): Promise<PaginatedResult<Operation>> {
  assertValid(ctx.organizationId, 'Organização é obrigatória', 'organizationId');
  assertPermission(ctx, 'operation.view');
  try {
    return await getServices().operations.list({
      organizationId: ctx.organizationId,
      status: query.status,
      search: query.search,
      page: query.page,
      pageSize: query.pageSize,
      signal: query.signal,
    });
  } catch (err) {
    throw toRepositoryError(err);
  }
}
