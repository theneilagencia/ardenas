/**
 * Arden.AS API — política de retry/backoff (ARDEN-BE-005 §20).
 * Determinístico (sem jitter) para testes estáveis. Backoff FIXED ou EXPONENTIAL.
 */

export type BackoffStrategy = 'FIXED' | 'EXPONENTIAL';

export interface RetryConfig {
  strategy: BackoffStrategy;
  initialDelayMs: number;
  maxDelayMs: number;
}

export const DEFAULT_RETRY: RetryConfig = {
  strategy: 'EXPONENTIAL',
  initialDelayMs: 1_000,
  maxDelayMs: 60_000,
};

/** Atraso (ms) antes da tentativa `attemptNumber` (1-based da PRÓXIMA tentativa). */
export function backoffDelayMs(config: RetryConfig, nextAttemptNumber: number): number {
  const n = Math.max(1, nextAttemptNumber);
  if (config.strategy === 'FIXED') return Math.min(config.initialDelayMs, config.maxDelayMs);
  const delay = config.initialDelayMs * 2 ** (n - 1);
  return Math.min(delay, config.maxDelayMs);
}

/** Códigos NÃO-retryable (§20): nunca reprocessam. */
export const NON_RETRYABLE_CODES: ReadonlySet<string> = new Set([
  'STEP_INPUT_INVALID',
  'STEP_EXECUTOR_NOT_AVAILABLE',
  'AUTHORIZATION_REQUIRED',
  'AUTHORIZATION_PAYLOAD_MISMATCH',
  'EXECUTION_NOT_ALLOWED',
  'ACTION_DENIED',
]);
