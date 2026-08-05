/**
 * Arden.AS — erros padronizados da camada de dados.
 * A UI trata por código; não depende de detalhes HTTP nem de exceções cruas.
 */

import { ArdenApiError } from './api-client';

export type ArdenRepositoryErrorCode =
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'CONFLICT'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NETWORK_ERROR'
  | 'UNAVAILABLE'
  | 'UNKNOWN';

export class ArdenRepositoryError extends Error {
  readonly code: ArdenRepositoryErrorCode;
  readonly fieldErrors?: Record<string, string[]>;
  readonly correlationId?: string;
  readonly cause?: unknown;

  constructor(
    code: ArdenRepositoryErrorCode,
    message: string,
    opts: { fieldErrors?: Record<string, string[]>; correlationId?: string; cause?: unknown } = {},
  ) {
    super(message);
    this.name = 'ArdenRepositoryError';
    this.code = code;
    this.fieldErrors = opts.fieldErrors;
    this.correlationId = opts.correlationId;
    this.cause = opts.cause;
  }

  /** Erros recuperáveis: vale oferecer nova tentativa. */
  get recoverable(): boolean {
    return this.code === 'NETWORK_ERROR' || this.code === 'UNAVAILABLE';
  }
}

const HTTP_TO_CODE: Record<number, ArdenRepositoryErrorCode> = {
  400: 'VALIDATION_ERROR',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  422: 'VALIDATION_ERROR',
  429: 'UNAVAILABLE',
  500: 'UNKNOWN',
  503: 'UNAVAILABLE',
};

/** Normaliza qualquer erro para `ArdenRepositoryError`. */
export function toRepositoryError(err: unknown): ArdenRepositoryError {
  if (err instanceof ArdenRepositoryError) return err;
  if (err instanceof ArdenApiError) {
    return new ArdenRepositoryError(HTTP_TO_CODE[err.status] ?? 'UNKNOWN', err.payload.message, {
      fieldErrors: err.payload.fieldErrors,
      correlationId: err.payload.correlationId,
      cause: err,
    });
  }
  if (err instanceof TypeError) {
    // fetch lança TypeError em falha de rede
    return new ArdenRepositoryError('NETWORK_ERROR', err.message, { cause: err });
  }
  const message = err instanceof Error ? err.message : String(err);
  return new ArdenRepositoryError('UNKNOWN', message, { cause: err });
}

/** Açúcar para validação de entrada em casos de uso. */
export function assertValid(condition: unknown, message: string, field?: string): asserts condition {
  if (!condition) {
    throw new ArdenRepositoryError('VALIDATION_ERROR', message, {
      fieldErrors: field ? { [field]: [message] } : undefined,
    });
  }
}
