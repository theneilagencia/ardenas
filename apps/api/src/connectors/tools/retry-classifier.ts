/**
 * Arden.AS API — classificação de retry/resultado incerto de ferramenta (ARDEN-BE-006.6).
 *
 * PURA e determinística. Decide, a partir do método, do modo de idempotência/retry e
 * do erro/status, se o resultado é SUCCEEDED/FAILED/UNKNOWN e se pode ser reprocessado.
 * Regra de ouro: operação NÃO idempotente com falha AMBÍGUA de transporte (timeout/drop
 * após possível envio) ⇒ UNKNOWN, nunca retry automático, nunca falha segura silenciosa.
 * O motor do BE-005 (backoff/maxAttempts) executa o retry — aqui só o CLASSIFICAMOS.
 */

import type { ExternalToolStatus } from './tool-execution.types';

export type IdempotencyMode = 'NONE' | 'OPTIONAL' | 'REQUIRED' | 'PROVIDER_NATIVE';
export type RetryMode = 'NEVER' | 'SAFE' | 'CONDITIONAL';
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface Classification {
  status: ExternalToolStatus;
  retryable: boolean;
  errorCode?: string;
  errorSummary?: string;
  retryAfterMs?: number;
}

/** Falhas DEFINITIVAS antes do envio (validação/política) — nunca incertas, nunca retry. */
const PRE_SEND_TERMINAL: ReadonlySet<string> = new Set([
  'SSRF_BLOCKED', 'HOST_NOT_ALLOWED', 'PROTOCOL_NOT_ALLOWED', 'PRIVATE_NETWORK_DENIED',
  'REDIRECT_DENIED', 'REQUEST_TOO_LARGE', 'NETWORK_POLICY_DENIED',
  'TOOL_INPUT_INVALID', 'TOOL_OUTPUT_INVALID', 'TOOL_EXECUTION_DENIED',
  'CREDENTIAL_REQUIRED', 'CREDENTIAL_INVALID', 'CREDENTIAL_REVOKED', 'CREDENTIAL_RESOLUTION_FAILED',
  'CONNECTION_NOT_ACTIVE', 'CONNECTION_SUSPENDED', 'CONNECTION_REVOKED',
  'TOOL_NOT_AVAILABLE', 'TOOL_BINDING_NOT_FOUND',
]);

/** Falhas AMBÍGUAS de transporte (pode ter chegado ao destino). */
const AMBIGUOUS_TRANSPORT: ReadonlySet<string> = new Set(['EXTERNAL_TIMEOUT', 'EXTERNAL_PROVIDER_ERROR']);

/** Idempotência efetiva: GET/PUT/DELETE são idempotentes; POST/PATCH só com chave. */
export function isIdempotent(method: HttpMethod, mode: IdempotencyMode): boolean {
  if (method === 'GET' || method === 'PUT' || method === 'DELETE') return true;
  return mode === 'REQUIRED' || mode === 'PROVIDER_NATIVE';
}

/** Classifica uma FALHA (erro tipado lançado pelo cliente HTTP / resolução). */
export function classifyError(
  errorCode: string,
  errorSummary: string,
  method: HttpMethod,
  idempotencyMode: IdempotencyMode,
  retryMode: RetryMode,
): Classification {
  if (PRE_SEND_TERMINAL.has(errorCode)) {
    return { status: 'FAILED', retryable: false, errorCode, errorSummary };
  }
  // Resposta grande demais: o servidor respondeu (efeito ocorreu); determinístico.
  if (errorCode === 'RESPONSE_TOO_LARGE') {
    return { status: 'FAILED', retryable: false, errorCode, errorSummary };
  }
  if (AMBIGUOUS_TRANSPORT.has(errorCode)) {
    if (!isIdempotent(method, idempotencyMode)) {
      // Não idempotente + falha ambígua ⇒ resultado incerto. Sem retry automático.
      return { status: 'UNKNOWN', retryable: false, errorCode: 'EXTERNAL_RESULT_UNKNOWN', errorSummary };
    }
    return { status: 'FAILED', retryable: retryMode !== 'NEVER', errorCode, errorSummary };
  }
  // Desconhecido: falha conservadora, sem retry.
  return { status: 'FAILED', retryable: false, errorCode, errorSummary };
}

/** Classifica uma RESPOSTA HTTP (status conhecido — o servidor respondeu). */
export function classifyResponse(
  status: number,
  method: HttpMethod,
  idempotencyMode: IdempotencyMode,
  retryMode: RetryMode,
  retryAfterMs?: number,
): Classification {
  if (status >= 200 && status < 300) return { status: 'SUCCEEDED', retryable: false };
  if (status === 429) {
    return { status: 'FAILED', retryable: retryMode !== 'NEVER', errorCode: 'EXTERNAL_RATE_LIMITED', errorSummary: `Provedor limitou a taxa (HTTP ${status}).`, retryAfterMs };
  }
  if (status >= 500) {
    const retryable = retryMode === 'SAFE' || (retryMode === 'CONDITIONAL' && isIdempotent(method, idempotencyMode));
    return { status: 'FAILED', retryable, errorCode: 'EXTERNAL_PROVIDER_ERROR', errorSummary: `Erro do provedor (HTTP ${status}).` };
  }
  // 3xx remanescente (redirect não seguido) e 4xx: falha definitiva, sem retry.
  return { status: 'FAILED', retryable: false, errorCode: 'EXTERNAL_PROVIDER_ERROR', errorSummary: `Resposta não tratável (HTTP ${status}).` };
}
