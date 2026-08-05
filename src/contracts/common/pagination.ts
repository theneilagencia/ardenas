/**
 * Arden.AS — API v1 · envelope e paginação (ARDEN-FE-003).
 *
 * Recurso único: `{ data, meta? }`. Lista: `{ data[], pagination }` por CURSOR
 * (auditoria e listas que crescem continuamente NÃO usam offset). Helpers
 * genéricos derivam schemas a partir do schema do item.
 */

import { z } from 'zod';

/** Envelope de recurso único. */
export function apiResponse<T extends z.ZodTypeAny>(data: T) {
  return z.object({ data, meta: z.record(z.unknown()).optional() });
}

/** Metadados de paginação por cursor. */
export const paginationMeta = z.object({
  cursor: z.string().nullable().optional(),
  nextCursor: z.string().nullable(),
  hasNextPage: z.boolean(),
  limit: z.number().int().min(1).max(200),
});
export type PaginationMeta = z.infer<typeof paginationMeta>;

/** Envelope de lista paginada por cursor. */
export function paginatedResponse<T extends z.ZodTypeAny>(item: T) {
  return z.object({ data: z.array(item), pagination: paginationMeta });
}

/** Parâmetros de paginação por cursor (query string). */
export const cursorPageParams = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});
export type CursorPageParams = z.infer<typeof cursorPageParams>;

/** Direção de ordenação. */
export const sortDirection = z.enum(['asc', 'desc']);
export type SortDirection = z.infer<typeof sortDirection>;

// Tipos utilitários (não deriváveis diretamente do helper genérico).
export interface ApiResponse<T> {
  data: T;
  meta?: Record<string, unknown>;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationMeta;
}
