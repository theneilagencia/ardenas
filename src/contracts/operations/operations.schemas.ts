/**
 * Arden.AS — API v1 · operações (schemas) (ARDEN-FE-003).
 *
 * Reconciliação com o frontend (ver FRONTEND_TO_API_V1_MAP.md):
 * - `OperationStatus` v1 = draft | active | paused | archived. O enum atual do
 *   frontend (draft | awaiting_approval | scheduled | running | paused | archived)
 *   colapsa scheduled/running → active; awaiting_approval pertence à execução
 *   (fora do escopo v1). Ver API_V1_OPEN_DECISIONS (D-002).
 * - O tenant NUNCA vem do body: `organizationId` está no PATH e é validado pela
 *   sessão. Requests de criação/edição não aceitam `organizationId`.
 */

import { z } from 'zod';
import { isoUtcDateTime } from '../common/timestamps';
import { operationId, operationVersionId, organizationId, userId } from '../common/identifiers';
import { sortDirection } from '../common/pagination';

export const operationStatus = z.enum(['draft', 'active', 'paused', 'archived']);
export type OperationStatus = z.infer<typeof operationStatus>;

/** Recurso Operação. `revision` habilita concorrência otimista. */
export const operation = z.object({
  id: operationId,
  organizationId,
  name: z.string().min(1).max(160),
  description: z.string().max(4000).nullable(),
  status: operationStatus,
  currentDraftVersionId: operationVersionId.nullable(),
  publishedVersionId: operationVersionId.nullable(),
  ownerId: userId.nullable(),
  createdBy: userId,
  createdAt: isoUtcDateTime,
  updatedAt: isoUtcDateTime,
  revision: z.number().int().min(0),
});
export type Operation = z.infer<typeof operation>;

// ── Requests ──────────────────────────────────────────────────────────────────

/** Filtros de listagem (query string). Cursor + limit vêm de cursorPageParams. */
export const listOperationsQuery = z.object({
  status: operationStatus.optional(),
  search: z.string().max(200).optional(),
  ownerId: z.string().optional(),
  authorityLevel: z.coerce.number().int().min(1).max(5).optional(),
  createdAfter: isoUtcDateTime.optional(),
  createdBefore: isoUtcDateTime.optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  sort: z.enum(['createdAt', 'updatedAt', 'name']).default('createdAt'),
  order: sortDirection.default('desc'),
});
export type ListOperationsQuery = z.infer<typeof listOperationsQuery>;

/**
 * Criação de operação. O backend cria, de forma TRANSACIONAL, a operação, a
 * primeira versão em rascunho e o evento de auditoria. Sem `organizationId` (path).
 */
export const createOperationRequest = z.object({
  name: z.string().min(1).max(160),
  description: z.string().max(4000).nullable().optional(),
  ownerId: z.string().optional(),
  sourceAssessmentId: z.string().optional(),
  clientReference: z.string().max(200).optional(),
});
export type CreateOperationRequest = z.infer<typeof createOperationRequest>;

/** Edição do recurso Operação (metadados). Concorrência via `expectedRevision`/If-Match. */
export const updateOperationRequest = z.object({
  name: z.string().min(1).max(160).optional(),
  description: z.string().max(4000).nullable().optional(),
  ownerId: z.string().nullable().optional(),
  expectedRevision: z.number().int().min(0),
});
export type UpdateOperationRequest = z.infer<typeof updateOperationRequest>;

/** Duplicação (comando idempotente). */
export const duplicateOperationRequest = z.object({
  name: z.string().min(1).max(160).optional(),
});
export type DuplicateOperationRequest = z.infer<typeof duplicateOperationRequest>;

/** Arquivar (comando idempotente, concorrência otimista). */
export const archiveOperationRequest = z.object({
  expectedRevision: z.number().int().min(0),
  reason: z.string().max(400).optional(),
});
export type ArchiveOperationRequest = z.infer<typeof archiveOperationRequest>;

/** Pausar/retomar (transição de estado, concorrência otimista). */
export const operationTransitionRequest = z.object({
  expectedRevision: z.number().int().min(0),
});
export type OperationTransitionRequest = z.infer<typeof operationTransitionRequest>;
