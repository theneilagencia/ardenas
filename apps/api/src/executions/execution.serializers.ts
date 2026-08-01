/**
 * Arden.AS API — serialização DB→contrato de execução (ARDEN-BE-005).
 * Valida a saída contra o schema do contrato.
 */

import type {
  ExecutionRun as DbRun,
  ExecutionStep as DbStep,
  ExecutionEvent as DbEvent,
  EvidenceRecord as DbEvidence,
} from '@prisma/client';
import {
  executionRun as runSchema,
  executionStep as stepSchema,
  executionEvent as eventSchema,
  evidenceRecord as evidenceSchema,
  type ExecutionRun,
  type ExecutionStep,
  type ExecutionEvent,
  type EvidenceRecord,
} from '@arden/contracts';

export function toRunContract(row: DbRun): ExecutionRun {
  return runSchema.parse({
    id: row.id,
    organizationId: row.organizationId,
    operationId: row.operationId,
    operationVersionId: row.operationVersionId,
    requestedByUserId: row.requestedByUserId,
    actionAuthorizationId: row.actionAuthorizationId ?? null,
    actionKey: row.actionKey,
    triggerType: row.triggerType,
    triggerReference: row.triggerReference ?? null,
    status: row.status,
    input: row.input,
    inputHash: row.inputHash,
    output: row.output ?? null,
    errorCode: row.errorCode ?? null,
    errorSummary: row.errorSummary ?? null,
    currentStepId: row.currentStepId ?? null,
    startedAt: row.startedAt ? row.startedAt.toISOString() : null,
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
    pausedAt: row.pausedAt ? row.pausedAt.toISOString() : null,
    cancelledAt: row.cancelledAt ? row.cancelledAt.toISOString() : null,
    timeoutAt: row.timeoutAt ? row.timeoutAt.toISOString() : null,
    attemptCount: row.attemptCount,
    maxAttempts: row.maxAttempts,
    correlationId: row.correlationId,
    revision: row.revision,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  });
}

export function toStepContract(row: DbStep): ExecutionStep {
  return stepSchema.parse({
    id: row.id,
    organizationId: row.organizationId,
    executionRunId: row.executionRunId,
    definitionStepKey: row.definitionStepKey,
    sequence: row.sequence,
    name: row.name,
    actionKey: row.actionKey,
    status: row.status,
    input: row.input,
    inputHash: row.inputHash,
    output: row.output ?? null,
    errorCode: row.errorCode ?? null,
    errorSummary: row.errorSummary ?? null,
    attemptCount: row.attemptCount,
    maxAttempts: row.maxAttempts,
    nextAttemptAt: row.nextAttemptAt ? row.nextAttemptAt.toISOString() : null,
    startedAt: row.startedAt ? row.startedAt.toISOString() : null,
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
    timeoutAt: row.timeoutAt ? row.timeoutAt.toISOString() : null,
    revision: row.revision,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  });
}

export function toEventContract(row: DbEvent): ExecutionEvent {
  return eventSchema.parse({
    id: row.id,
    organizationId: row.organizationId,
    executionRunId: row.executionRunId,
    executionStepId: row.executionStepId ?? null,
    sequence: Number(row.sequence),
    eventType: row.eventType,
    actorType: row.actorType,
    actorId: row.actorId ?? null,
    correlationId: row.correlationId,
    causationId: row.causationId ?? null,
    payload: row.payload,
    occurredAt: row.occurredAt.toISOString(),
  });
}

export function toEvidenceContract(row: DbEvidence): EvidenceRecord {
  return evidenceSchema.parse({
    id: row.id,
    organizationId: row.organizationId,
    executionRunId: row.executionRunId,
    executionStepId: row.executionStepId ?? null,
    evidenceType: row.evidenceType,
    content: row.content,
    contentHash: row.contentHash,
    storageReference: row.storageReference ?? null,
    mimeType: row.mimeType ?? null,
    createdByType: row.createdByType,
    createdById: row.createdById ?? null,
    correlationId: row.correlationId,
    createdAt: row.createdAt.toISOString(),
  });
}
