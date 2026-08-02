# Retry de ferramenta externa — ARDEN-BE-006.6

> A classificação decide `SUCCEEDED/FAILED/UNKNOWN` e `retryable`; o **retry em si é
> executado pelo motor do BE-005** (backoff/`maxAttempts` de `retry-policy.ts`) — não
> há mecanismo de retry paralelo. Idempotency-key **estável por etapa**
> (`arden:<runId>:<stepId>`) — retries reusam a MESMA chave (provider dedup).

## Idempotência efetiva

`isIdempotent(method, idempotencyMode)`: `GET/PUT/DELETE` sempre; `POST/PATCH` só com
`idempotencyMode ∈ {REQUIRED, PROVIDER_NATIVE}`.

## Classificação de erro

| Situação | Resultado | Retry |
| --- | --- | --- |
| SSRF / política / host / protocolo / request grande | FAILED | não |
| `TOOL_INPUT_INVALID` / `TOOL_OUTPUT_INVALID` / credential_* / connection_* | FAILED | não |
| `RESPONSE_TOO_LARGE` (servidor respondeu) | FAILED | não |
| timeout/erro de transporte, **idempotente** | FAILED | `retryMode ≠ NEVER` |
| timeout/erro de transporte, **NÃO idempotente** | **UNKNOWN** | **não** |

## Classificação de resposta HTTP

| Status | Resultado | Retry |
| --- | --- | --- |
| 2xx | SUCCEEDED | — |
| 429 | FAILED (`EXTERNAL_RATE_LIMITED`) | `retryMode ≠ NEVER`, respeita `Retry-After` |
| 5xx | FAILED (`EXTERNAL_PROVIDER_ERROR`) | `SAFE` ou (`CONDITIONAL` e idempotente) |
| 4xx (≠429) | FAILED | não |

`Retry-After` é convertido em `retryAfterMs` (respeitando o teto de backoff do motor).
Códigos não-retryáveis do BE-006 (`SSRF_BLOCKED`, `NETWORK_POLICY_DENIED`,
`TOOL_INPUT_INVALID`, `CREDENTIAL_*`) integram `NON_RETRYABLE_CODES`.
