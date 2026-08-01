/**
 * Arden.AS — API v1 · erros (ARDEN-FE-003).
 *
 * Resposta de erro ÚNICA e tipada. Nunca expõe stack trace nem detalhes internos
 * de banco. `correlationId` está sempre presente. Os códigos são estáveis e
 * mapeiam para status HTTP documentados (ver API_V1_ERROR_CATALOG.md).
 */

import { z } from 'zod';
import { correlationId } from './identifiers';

export const apiErrorCode = z.enum([
  'VALIDATION_ERROR',
  'UNAUTHENTICATED',
  'SESSION_EXPIRED',
  'FORBIDDEN',
  'ORGANIZATION_REQUIRED',
  'ORGANIZATION_SUSPENDED',
  'MEMBERSHIP_REQUIRED',
  'MEMBERSHIP_SUSPENDED',
  'RESOURCE_NOT_FOUND',
  'VERSION_CONFLICT',
  'RESOURCE_CONFLICT',
  'ALREADY_PUBLISHED',
  'INVALID_STATE_TRANSITION',
  'IDEMPOTENCY_CONFLICT',
  // Governança, aprovações e autorizações de ação (ARDEN-BE-004).
  'APPROVAL_REQUIRED',
  'APPROVAL_NOT_PENDING',
  'APPROVAL_NOT_ELIGIBLE',
  'SELF_APPROVAL_FORBIDDEN',
  'APPROVAL_EXPIRED',
  'APPROVAL_INVALIDATED',
  'APPROVAL_ALREADY_DECIDED',
  'QUORUM_NOT_REACHED',
  'POLICY_CONFLICT',
  'POLICY_NOT_ACTIVE',
  'ACTION_DENIED',
  'ACTION_NOT_DECLARED',
  'AUTHORIZATION_EXPIRED',
  'AUTHORIZATION_INVALIDATED',
  'AUTHORIZATION_PAYLOAD_MISMATCH',
  // Motor de execução (ARDEN-BE-005).
  'EXECUTION_NOT_ALLOWED',
  'EXECUTION_ALREADY_STARTED',
  'EXECUTION_NOT_PAUSABLE',
  'EXECUTION_NOT_RESUMABLE',
  'EXECUTION_NOT_CANCELLABLE',
  'EXECUTION_NOT_RETRYABLE',
  'EXECUTION_TERMINAL',
  'EXECUTION_TIMED_OUT',
  'EXECUTION_RETRY_EXHAUSTED',
  'STEP_EXECUTOR_NOT_AVAILABLE',
  'STEP_INPUT_INVALID',
  'STEP_FAILED',
  'STEP_TIMED_OUT',
  'AUTHORIZATION_REQUIRED',
  'AUTHORIZATION_ALREADY_USED',
  'JOB_LEASE_CONFLICT',
  'JOB_NOT_RECOVERABLE',
  'RATE_LIMITED',
  'DEPENDENCY_UNAVAILABLE',
  'INTERNAL_ERROR',
]);
export type ApiErrorCode = z.infer<typeof apiErrorCode>;

export const fieldError = z.object({
  field: z.string(),
  code: z.string(),
  message: z.string(),
});
export type FieldError = z.infer<typeof fieldError>;

export const apiErrorBody = z.object({
  code: apiErrorCode,
  message: z.string(),
  correlationId,
  /** Detalhes seguros (ex.: revisão esperada/atual em conflito). Nunca dados internos. */
  details: z.record(z.unknown()).optional(),
  fieldErrors: z.array(fieldError).optional(),
});
export type ApiErrorBody = z.infer<typeof apiErrorBody>;

/** Envelope de erro. */
export const apiErrorResponse = z.object({ error: apiErrorBody });
export type ApiErrorResponse = z.infer<typeof apiErrorResponse>;

/** Detalhe padronizado de conflito de concorrência (VERSION_CONFLICT). */
export const versionConflictDetails = z.object({
  resourceType: z.string(),
  resourceId: z.string(),
  expectedRevision: z.number().int(),
  currentRevision: z.number().int(),
});
export type VersionConflictDetails = z.infer<typeof versionConflictDetails>;

/** Mapa canônico código → status HTTP (documentado em API_V1_ERROR_CATALOG.md). */
export const ERROR_HTTP_STATUS: Record<ApiErrorCode, number> = {
  VALIDATION_ERROR: 422,
  UNAUTHENTICATED: 401,
  SESSION_EXPIRED: 401,
  FORBIDDEN: 403,
  ORGANIZATION_REQUIRED: 403,
  ORGANIZATION_SUSPENDED: 403,
  MEMBERSHIP_REQUIRED: 403,
  MEMBERSHIP_SUSPENDED: 403,
  RESOURCE_NOT_FOUND: 404,
  VERSION_CONFLICT: 409,
  RESOURCE_CONFLICT: 409,
  ALREADY_PUBLISHED: 409,
  INVALID_STATE_TRANSITION: 409,
  IDEMPOTENCY_CONFLICT: 409,
  APPROVAL_REQUIRED: 403,
  APPROVAL_NOT_PENDING: 409,
  APPROVAL_NOT_ELIGIBLE: 403,
  SELF_APPROVAL_FORBIDDEN: 403,
  APPROVAL_EXPIRED: 409,
  APPROVAL_INVALIDATED: 409,
  APPROVAL_ALREADY_DECIDED: 409,
  QUORUM_NOT_REACHED: 409,
  POLICY_CONFLICT: 409,
  POLICY_NOT_ACTIVE: 409,
  ACTION_DENIED: 403,
  ACTION_NOT_DECLARED: 409,
  AUTHORIZATION_EXPIRED: 409,
  AUTHORIZATION_INVALIDATED: 409,
  AUTHORIZATION_PAYLOAD_MISMATCH: 409,
  EXECUTION_NOT_ALLOWED: 403,
  EXECUTION_ALREADY_STARTED: 409,
  EXECUTION_NOT_PAUSABLE: 409,
  EXECUTION_NOT_RESUMABLE: 409,
  EXECUTION_NOT_CANCELLABLE: 409,
  EXECUTION_NOT_RETRYABLE: 409,
  EXECUTION_TERMINAL: 409,
  EXECUTION_TIMED_OUT: 409,
  EXECUTION_RETRY_EXHAUSTED: 409,
  STEP_EXECUTOR_NOT_AVAILABLE: 409,
  STEP_INPUT_INVALID: 422,
  STEP_FAILED: 409,
  STEP_TIMED_OUT: 409,
  AUTHORIZATION_REQUIRED: 403,
  AUTHORIZATION_ALREADY_USED: 409,
  JOB_LEASE_CONFLICT: 409,
  JOB_NOT_RECOVERABLE: 409,
  RATE_LIMITED: 429,
  DEPENDENCY_UNAVAILABLE: 503,
  INTERNAL_ERROR: 500,
};
