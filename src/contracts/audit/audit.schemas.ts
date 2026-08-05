/**
 * Arden.AS — API v1 · auditoria (schemas) (ARDEN-FE-003).
 *
 * SOMENTE LEITURA pela API pública: não há POST/PATCH/DELETE de eventos para
 * clientes comuns. Os eventos são gerados/validados pelo BACKEND (comandos de
 * domínio produzem auditoria transacionalmente). Mapeamento a partir do
 * `AuditEvent` do frontend: objectType→resourceType, objectId→resourceId,
 * previousValue→before, newValue→after, timestamp→occurredAt (ver
 * FRONTEND_TO_API_V1_MAP.md). Recomenda-se log append-only imutável (GAP-05).
 */

import { z } from 'zod';
import { isoUtcDateTime } from '../common/timestamps';
import { auditEventId, correlationId, organizationId } from '../common/identifiers';

export const auditSource = z.enum(['user', 'system', 'integration']);
export type AuditSource = z.infer<typeof auditSource>;

export const auditActor = z.object({
  id: z.string().min(1),
  type: auditSource,
  role: z.string().nullable(),
  displayName: z.string().nullable(),
});
export type AuditActor = z.infer<typeof auditActor>;

export const auditEvent = z.object({
  id: auditEventId,
  organizationId,
  actor: auditActor,
  action: z.string().min(1),
  resourceType: z.string().min(1),
  resourceId: z.string().min(1),
  occurredAt: isoUtcDateTime,
  correlationId,
  source: auditSource,
  before: z.unknown().nullable(),
  after: z.unknown().nullable(),
  metadata: z.record(z.unknown()),
});
export type AuditEvent = z.infer<typeof auditEvent>;

/** Filtros de auditoria (query string). Paginação por CURSOR (nunca offset). */
export const listAuditEventsQuery = z.object({
  actorId: z.string().optional(),
  action: z.string().optional(),
  resourceType: z.string().optional(),
  resourceId: z.string().optional(),
  from: isoUtcDateTime.optional(),
  to: isoUtcDateTime.optional(),
  correlationId: z.string().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});
export type ListAuditEventsQuery = z.infer<typeof listAuditEventsQuery>;
