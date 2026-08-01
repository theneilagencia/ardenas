/**
 * Arden.AS API — erros de domínio da API (ARDEN-BE-001).
 *
 * Reusa o catálogo de erros do CONTRATO compartilhado (`@arden/contracts`):
 * códigos e mapa código→HTTP. Não redefine DTOs. `ApiException` carrega um código
 * do catálogo; o filtro global a serializa no envelope `ApiErrorResponse`.
 */

import {
  ERROR_HTTP_STATUS,
  type ApiErrorCode,
  type FieldError,
} from '@arden/contracts';

export interface ApiExceptionOptions {
  message?: string;
  details?: Record<string, unknown>;
  fieldErrors?: FieldError[];
  cause?: unknown;
}

/** Exceção tipada da API. O `code` vem do catálogo do contrato. */
export class ApiException extends Error {
  readonly code: ApiErrorCode;
  readonly httpStatus: number;
  readonly details?: Record<string, unknown>;
  readonly fieldErrors?: FieldError[];

  constructor(code: ApiErrorCode, opts: ApiExceptionOptions = {}) {
    super(opts.message ?? code);
    this.name = 'ApiException';
    this.code = code;
    this.httpStatus = ERROR_HTTP_STATUS[code];
    this.details = opts.details;
    this.fieldErrors = opts.fieldErrors;
    if (opts.cause) this.cause = opts.cause;
  }
}

// Fábricas de conveniência para os erros de fundação.
export const notFound = (message = 'Recurso não encontrado.') =>
  new ApiException('RESOURCE_NOT_FOUND', { message });

export const validationError = (fieldErrors: FieldError[], message = 'Dados inválidos.') =>
  new ApiException('VALIDATION_ERROR', { message, fieldErrors });

export const dependencyUnavailable = (message = 'Dependência indisponível.') =>
  new ApiException('DEPENDENCY_UNAVAILABLE', { message });

export const idempotencyConflict = (message = 'Idempotency-Key reutilizada com corpo diferente.') =>
  new ApiException('IDEMPOTENCY_CONFLICT', { message });

export const versionConflict = (
  details: { resourceType: string; resourceId: string; expectedRevision: number; currentRevision: number },
  message = 'Revisão desatualizada.',
) => new ApiException('VERSION_CONFLICT', { message, details });

/** Tentativa de alterar/publicar uma versão já publicada (imutável). */
export const alreadyPublished = (message = 'Versão já publicada é imutável.') =>
  new ApiException('ALREADY_PUBLISHED', { message });

/** Transição de estado inválida (ex.: retomar operação arquivada). */
export const invalidStateTransition = (message = 'Transição de estado inválida.') =>
  new ApiException('INVALID_STATE_TRANSITION', { message });

/** Conflito de estado do recurso (ex.: já existe um rascunho ativo). */
export const resourceConflict = (message = 'Conflito de estado do recurso.') =>
  new ApiException('RESOURCE_CONFLICT', { message });

// ── Governança, aprovações e enforcement (ARDEN-BE-004) ─────────────────────────
/** A ação exige aprovação humana antes de ser autorizada. */
export const approvalRequired = (message = 'Ação exige aprovação.', details?: Record<string, unknown>) =>
  new ApiException('APPROVAL_REQUIRED', { message, details });

/** A solicitação não está mais pendente (decidida/cancelada/expirada). */
export const approvalNotPending = (message = 'Solicitação não está pendente.') =>
  new ApiException('APPROVAL_NOT_PENDING', { message });

/** O usuário não é elegível a decidir esta etapa. */
export const approvalNotEligible = (message = 'Aprovador não elegível para esta etapa.') =>
  new ApiException('APPROVAL_NOT_ELIGIBLE', { message });

/** Segregação de funções: o solicitante não pode aprovar a própria ação. */
export const selfApprovalForbidden = (message = 'Solicitante não pode aprovar a própria ação.') =>
  new ApiException('SELF_APPROVAL_FORBIDDEN', { message });

/** A solicitação expirou e não autoriza mais a ação. */
export const approvalExpired = (message = 'Solicitação de aprovação expirada.') =>
  new ApiException('APPROVAL_EXPIRED', { message });

/** A solicitação foi invalidada por mudança material na operação/política. */
export const approvalInvalidated = (message = 'Solicitação invalidada por mudança material.') =>
  new ApiException('APPROVAL_INVALIDATED', { message });

/** O mesmo aprovador já decidiu esta etapa (decisão imutável). */
export const approvalAlreadyDecided = (message = 'Aprovador já decidiu esta etapa.') =>
  new ApiException('APPROVAL_ALREADY_DECIDED', { message });

/** O quórum da etapa ainda não foi atingido. */
export const quorumNotReached = (message = 'Quórum não atingido.') =>
  new ApiException('QUORUM_NOT_REACHED', { message });

/** Conflito entre políticas aplicáveis. */
export const policyConflict = (message = 'Conflito de políticas.') =>
  new ApiException('POLICY_CONFLICT', { message });

/** A política referida não está ativa/publicada. */
export const policyNotActive = (message = 'Política não está ativa.') =>
  new ApiException('POLICY_NOT_ACTIVE', { message });

/** A ação foi bloqueada pela avaliação de autoridade. */
export const actionDenied = (message = 'Ação bloqueada.', details?: Record<string, unknown>) =>
  new ApiException('ACTION_DENIED', { message, details });

/** A ação não está declarada no Gradiente de Autoridade da operação. */
export const actionNotDeclared = (message = 'Ação não declarada para esta operação.') =>
  new ApiException('ACTION_NOT_DECLARED', { message });

/** A autorização de ação expirou. */
export const authorizationExpired = (message = 'Autorização de ação expirada.') =>
  new ApiException('AUTHORIZATION_EXPIRED', { message });

/** A autorização de ação foi invalidada. */
export const authorizationInvalidated = (message = 'Autorização de ação invalidada.') =>
  new ApiException('AUTHORIZATION_INVALIDATED', { message });

/** O payload apresentado não casa com o payload autorizado. */
export const authorizationPayloadMismatch = (message = 'Payload difere do autorizado.') =>
  new ApiException('AUTHORIZATION_PAYLOAD_MISMATCH', { message });

// ── Motor de execução (ARDEN-BE-005) ────────────────────────────────────────────
export const executionNotAllowed = (message = 'Execução não permitida.', details?: Record<string, unknown>) =>
  new ApiException('EXECUTION_NOT_ALLOWED', { message, details });
export const executionAlreadyStarted = (message = 'Execução já iniciada.') =>
  new ApiException('EXECUTION_ALREADY_STARTED', { message });
export const executionNotPausable = (message = 'Execução não pode ser pausada neste estado.') =>
  new ApiException('EXECUTION_NOT_PAUSABLE', { message });
export const executionNotResumable = (message = 'Execução não pode ser retomada neste estado.') =>
  new ApiException('EXECUTION_NOT_RESUMABLE', { message });
export const executionNotCancellable = (message = 'Execução não pode ser cancelada neste estado.') =>
  new ApiException('EXECUTION_NOT_CANCELLABLE', { message });
export const executionNotRetryable = (message = 'Execução não pode ser reprocessada neste estado.') =>
  new ApiException('EXECUTION_NOT_RETRYABLE', { message });
export const executionTerminal = (message = 'Execução em estado terminal.') =>
  new ApiException('EXECUTION_TERMINAL', { message });
export const executionRetryExhausted = (message = 'Tentativas de execução esgotadas.') =>
  new ApiException('EXECUTION_RETRY_EXHAUSTED', { message });
export const stepExecutorNotAvailable = (message = 'Executor de etapa indisponível.') =>
  new ApiException('STEP_EXECUTOR_NOT_AVAILABLE', { message });
export const stepInputInvalid = (fieldErrors: FieldError[], message = 'Entrada de etapa inválida.') =>
  new ApiException('STEP_INPUT_INVALID', { message, fieldErrors });
export const authorizationRequired = (message = 'Ação exige uma autorização de ação.') =>
  new ApiException('AUTHORIZATION_REQUIRED', { message });
export const authorizationAlreadyUsed = (message = 'Autorização de ação já utilizada.') =>
  new ApiException('AUTHORIZATION_ALREADY_USED', { message });
export const jobLeaseConflict = (message = 'Conflito de lease de job.') =>
  new ApiException('JOB_LEASE_CONFLICT', { message });
