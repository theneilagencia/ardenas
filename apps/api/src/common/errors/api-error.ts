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
