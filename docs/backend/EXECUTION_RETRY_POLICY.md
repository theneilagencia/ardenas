# Política de Retry (ARDEN-BE-005 §20)

Por etapa: `maxAttempts` (do request, default 1). Backoff determinístico (sem jitter)
em `retry-policy.ts`: `FIXED` ou `EXPONENTIAL` (default `initial=1s`, `max=60s`).

- Falha **retryable** e `attempt < maxAttempts` → etapa `RETRY_WAIT` com
  `nextAttemptAt = now + backoff`; o job é reagendado para o mesmo instante.
- Falha **não-retryable** ou tentativas esgotadas → etapa `FAILED` → execução
  `FAILED` → compensação.

**Nunca retryable** (`NON_RETRYABLE_CODES`): `STEP_INPUT_INVALID`,
`STEP_EXECUTOR_NOT_AVAILABLE`, `AUTHORIZATION_REQUIRED`,
`AUTHORIZATION_PAYLOAD_MISMATCH`, `EXECUTION_NOT_ALLOWED`, `ACTION_DENIED`.

Sem retries infinitos. Um retry não duplica efeito: os executores internos são
determinísticos (mesma etapa → mesmo efeito) — ver `EXECUTION_ACTION_EXECUTORS_V1.md`.
