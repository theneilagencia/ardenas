/**
 * Arden.AS — API v1 · execuções (schemas) (ARDEN-BE-005).
 *
 * Execução assíncrona e durável de uma versão PUBLICADA. O backend é a fonte de
 * verdade do estado; o cliente apenas comanda (criar/pausar/retomar/cancelar/
 * retry) e acompanha por polling. Eventos e evidências são append-only. Tenant
 * sempre no path.
 */

import { z } from 'zod';
import { isoUtcDateTime } from '../common/timestamps';
import {
  executionRunId,
  executionStepId,
  executionEventId,
  evidenceRecordId,
  actionAuthorizationId,
  operationId,
  operationVersionId,
  organizationId,
  userId,
  correlationId,
} from '../common/identifiers';
import { actionKey } from '../approvals/approvals.schemas';

// ── Enums (espelham o Prisma) ───────────────────────────────────────────────────
export const executionTriggerType = z.enum(['MANUAL', 'API', 'SCHEDULED', 'SYSTEM']);
export const executionRunStatus = z.enum([
  'PENDING', 'QUEUED', 'RUNNING', 'PAUSE_REQUESTED', 'PAUSED', 'RESUME_REQUESTED',
  'CANCEL_REQUESTED', 'CANCELLED', 'SUCCEEDED', 'FAILED',
  'COMPENSATING', 'COMPENSATED', 'COMPENSATION_FAILED', 'TIMED_OUT',
]);
export type ExecutionRunStatus = z.infer<typeof executionRunStatus>;
export const executionStepStatus = z.enum([
  'PENDING', 'READY', 'RUNNING', 'RETRY_WAIT', 'PAUSED', 'SUCCEEDED', 'FAILED',
  'SKIPPED', 'CANCELLED', 'COMPENSATING', 'COMPENSATED', 'COMPENSATION_FAILED', 'TIMED_OUT',
]);
export type ExecutionStepStatus = z.infer<typeof executionStepStatus>;
export const executionActorType = z.enum(['USER', 'SYSTEM', 'WORKER']);
export type ExecutionActorType = z.infer<typeof executionActorType>;
export const evidenceType = z.enum([
  'INPUT', 'OUTPUT', 'DECISION', 'AUTHORIZATION', 'ERROR', 'STATE_TRANSITION', 'COMPENSATION',
]);
export type EvidenceType = z.infer<typeof evidenceType>;

/** Executores determinísticos internos permitidos nesta fase (ARDEN-BE-005 §15). */
export const executorActionKey = z.enum([
  'system.noop',
  'data.transform.static',
  'data.validate.schema',
  'record.create.internal',
  'record.update.internal',
  'decision.evaluate.static',
  'evidence.record',
  'delay.simulated',
  'failure.deterministic',
]);
export type ExecutorActionKey = z.infer<typeof executorActionKey>;

export const backoffStrategy = z.enum(['FIXED', 'EXPONENTIAL']);

// ── Entidades ───────────────────────────────────────────────────────────────────
export const executionRun = z.object({
  id: executionRunId,
  organizationId,
  operationId,
  operationVersionId,
  requestedByUserId: userId,
  actionAuthorizationId: actionAuthorizationId.nullable(),
  actionKey,
  triggerType: executionTriggerType,
  triggerReference: z.string().nullable(),
  status: executionRunStatus,
  input: z.unknown(),
  inputHash: z.string(),
  output: z.unknown().nullable(),
  errorCode: z.string().nullable(),
  errorSummary: z.string().nullable(),
  currentStepId: executionStepId.nullable(),
  startedAt: isoUtcDateTime.nullable(),
  completedAt: isoUtcDateTime.nullable(),
  pausedAt: isoUtcDateTime.nullable(),
  cancelledAt: isoUtcDateTime.nullable(),
  timeoutAt: isoUtcDateTime.nullable(),
  attemptCount: z.number().int().min(0),
  maxAttempts: z.number().int().min(1),
  correlationId,
  revision: z.number().int().min(0),
  createdAt: isoUtcDateTime,
  updatedAt: isoUtcDateTime,
});
export type ExecutionRun = z.infer<typeof executionRun>;

export const executionStep = z.object({
  id: executionStepId,
  organizationId,
  executionRunId,
  definitionStepKey: z.string(),
  sequence: z.number().int().min(1),
  name: z.string(),
  actionKey: executorActionKey,
  status: executionStepStatus,
  input: z.unknown(),
  inputHash: z.string(),
  output: z.unknown().nullable(),
  errorCode: z.string().nullable(),
  errorSummary: z.string().nullable(),
  attemptCount: z.number().int().min(0),
  maxAttempts: z.number().int().min(1),
  nextAttemptAt: isoUtcDateTime.nullable(),
  startedAt: isoUtcDateTime.nullable(),
  completedAt: isoUtcDateTime.nullable(),
  timeoutAt: isoUtcDateTime.nullable(),
  revision: z.number().int().min(0),
  createdAt: isoUtcDateTime,
  updatedAt: isoUtcDateTime,
});
export type ExecutionStep = z.infer<typeof executionStep>;

export const executionEvent = z.object({
  id: executionEventId,
  organizationId,
  executionRunId,
  executionStepId: executionStepId.nullable(),
  sequence: z.number().int().min(1),
  eventType: z.string(),
  actorType: executionActorType,
  actorId: userId.nullable(),
  correlationId,
  causationId: z.string().nullable(),
  payload: z.record(z.unknown()),
  occurredAt: isoUtcDateTime,
});
export type ExecutionEvent = z.infer<typeof executionEvent>;

export const evidenceRecord = z.object({
  id: evidenceRecordId,
  organizationId,
  executionRunId,
  executionStepId: executionStepId.nullable(),
  evidenceType,
  content: z.record(z.unknown()),
  contentHash: z.string(),
  storageReference: z.string().nullable(),
  mimeType: z.string().nullable(),
  createdByType: executionActorType,
  createdById: userId.nullable(),
  correlationId,
  createdAt: isoUtcDateTime,
});
export type EvidenceRecord = z.infer<typeof evidenceRecord>;

// ── Requests ──────────────────────────────────────────────────────────────────
/**
 * Criação de execução. `actionKey` declara a ação (taxonomia BE-004) para o
 * enforcement de autoridade. `stepExecutors` (opcional) escolhe o executor
 * determinístico por etapa; ausente, usa o mapeamento default documentado.
 */
export const createExecutionRequest = z.object({
  operationVersionId: operationVersionId.optional(),
  actionKey,
  input: z.unknown(),
  actionAuthorizationId: actionAuthorizationId.optional(),
  maxAttempts: z.number().int().min(1).max(50).optional(),
  timeoutSeconds: z.number().int().min(1).max(86_400).optional(),
  stepExecutors: z.record(executorActionKey).optional(),
});
export type CreateExecutionRequest = z.infer<typeof createExecutionRequest>;

/** Comando de transição (pause/resume/cancel/retry). Concorrência via expectedRevision. */
export const executionCommandRequest = z.object({
  expectedRevision: z.number().int().min(0),
  reason: z.string().max(400).optional(),
});
export type ExecutionCommandRequest = z.infer<typeof executionCommandRequest>;

export const listExecutionsQuery = z.object({
  status: executionRunStatus.optional(),
  operationId: z.string().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});
export type ListExecutionsQuery = z.infer<typeof listExecutionsQuery>;

export const listExecutionEventsQuery = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
});
export type ListExecutionEventsQuery = z.infer<typeof listExecutionEventsQuery>;
