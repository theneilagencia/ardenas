/**
 * Arden.AS API — política de retry do Anthropic (ARDEN-BE-008.1).
 *
 * PURO e determinístico (jitter injetável). Retry SOMENTE de falhas classificadas como
 * retryable; backoff exponencial + jitter; respeita Retry-After; teto de tentativas;
 * deadline global; sem retry após cancelamento; sem retry cego de resultado incerto.
 * Recomenda-se DESABILITAR o retry automático do SDK e controlar aqui. Sem SDK.
 */

import type { AnthropicMappedError } from './anthropic-error-mapper';

export interface AnthropicRetryOptions {
  maxAttempts: number; // teto de tentativas (inclui a primeira).
  baseDelayMs: number;
  maxDelayMs: number;
}

export const ANTHROPIC_RETRY_DEFAULT: AnthropicRetryOptions = {
  maxAttempts: 3,
  baseDelayMs: 500,
  maxDelayMs: 15_000,
};

export interface RetryDecision {
  retry: boolean;
  delayMs: number;
  reason: string;
}

/**
 * Decide o retry. `attempt` é 1-based (1 = primeira falha). `deadlineRemainingMs` é o
 * tempo restante do deadline global. `jitter` ∈ [0,1) é injetado (determinístico em teste).
 * Resultado INCERTO (unknown) nunca é retriado automaticamente (risco semântico).
 */
export function decideAnthropicRetry(
  error: AnthropicMappedError,
  attempt: number,
  opts: AnthropicRetryOptions,
  deadlineRemainingMs: number,
  jitter = 0,
): RetryDecision {
  if (!error.retryable) return { retry: false, delayMs: 0, reason: 'non_retryable' };
  if (error.unknown) return { retry: false, delayMs: 0, reason: 'uncertain_result_not_retried' };
  if (attempt >= opts.maxAttempts) return { retry: false, delayMs: 0, reason: 'max_attempts' };

  const delayMs = computeAnthropicBackoffMs(attempt, opts, error.retryAfterMs, jitter);
  if (delayMs >= deadlineRemainingMs) return { retry: false, delayMs: 0, reason: 'deadline_exceeded' };
  return { retry: true, delayMs, reason: 'retry' };
}

/** Backoff exponencial (2^(attempt-1) × base), com teto, honrando Retry-After. Sem float aleatório. */
export function computeAnthropicBackoffMs(
  attempt: number,
  opts: AnthropicRetryOptions,
  retryAfterMs: number | null | undefined,
  jitter = 0,
): number {
  if (retryAfterMs != null && retryAfterMs > 0) return Math.min(retryAfterMs, opts.maxDelayMs);
  const exp = opts.baseDelayMs * 2 ** (attempt - 1);
  const capped = Math.min(exp, opts.maxDelayMs);
  // Jitter determinístico: adiciona [0, base) proporcional ao fator injetado.
  const jittered = capped + Math.floor(jitter * opts.baseDelayMs);
  return Math.min(jittered, opts.maxDelayMs);
}
