# Anthropic — mapeamento de erros (ARDEN-BE-008.1)

> Mapeamento verificado sobre `@anthropic-ai/sdk@0.115.0` (classes de erro em
> `core/error.d.ts`, ver `ANTHROPIC_OFFICIAL_SOURCE_REGISTER.md`). O adapter converte a
> classe de erro para código canônico `MODEL_*`/`AGENT_*`; nenhum tipo do SDK escapa do
> domínio. Doc de auditoria — NADA de código/SDK nesta fase.

## Matriz de erros (14 classes verificadas)

Códigos canônicos verificados em `AGENT_RUNTIME_ERROR_MODEL.md` e
`apps/api/src/agents/runtime/agent-runtime.ts`: `MODEL_RATE_LIMITED`,
`MODEL_PROVIDER_ERROR`, `MODEL_RESULT_UNKNOWN`, `MODEL_CONTENT_FILTERED`, `AGENT_TIMEOUT`.

| Classe (SDK) | HTTP | Código Arden | Retryável | UNKNOWN | Público |
| --- | --- | --- | --- | --- | --- |
| `BadRequestError` | 400 | `MODEL_PROVIDER_ERROR` (request inválido) | não | não | não |
| `AuthenticationError` | 401 | `MODEL_PROVIDER_ERROR` | não | não | não |
| `PermissionDeniedError` | 403 | `MODEL_PROVIDER_ERROR` | não | não | não |
| `NotFoundError` | 404 | `MODEL_PROVIDER_ERROR` | não | não | não |
| `ConflictError` | 409 | `MODEL_PROVIDER_ERROR` | não | não | não |
| `UnprocessableEntityError` | 422 | `MODEL_PROVIDER_ERROR` | não | não | não |
| `RateLimitError` | 429 | `MODEL_RATE_LIMITED` | sim (`Retry-After`) | não | não |
| `InternalServerError` | 5xx | `MODEL_PROVIDER_ERROR` | sim (backoff) | condicional¹ | não |
| `APIConnectionError` | — | `MODEL_PROVIDER_ERROR` (rede) | sim (backoff) | condicional¹ | não |
| `APIConnectionTimeoutError` | — | `AGENT_TIMEOUT` / `MODEL_RESULT_UNKNOWN`² | sim/condicional | condicional² | não |
| `APIUserAbortError` | — | `AGENT_TIMEOUT` (abort) | não | não | não |
| `APIError` (genérico) | var. | `MODEL_PROVIDER_ERROR` | conforme HTTP | condicional¹ | não |
| `RetryableError` | — | `MODEL_PROVIDER_ERROR` | sim (backoff) | não | não |
| `AnthropicError` (base) | — | `MODEL_PROVIDER_ERROR` | não (default seguro) | não | não |
| resposta malformada | — | `MODEL_PROVIDER_ERROR` | não | **sim** (sem output válido) | não |

¹ **UNKNOWN se o envio for incerto**: se não há garantia de que a resposta não foi
produzida (conexão caiu após envio, efeito possível de orquestração de tools) →
`MODEL_RESULT_UNKNOWN`, nunca sucesso e nunca retry cego. Ver `ANTHROPIC_RETRY_AND_UNKNOWN.md`.

² **Timeout**: timeout ANTES do envio → `AGENT_TIMEOUT`, retryável (request não saiu);
timeout APÓS envio com efeito incerto → `MODEL_RESULT_UNKNOWN`, não retryável.

## Regras

- `content filter`/`refusal` (via `StopReason`) → `MODEL_CONTENT_FILTERED`,
  `finishReason = CONTENT_FILTER`, não retryável (ver mapeamento request/response).
- Nenhum código público novo: todos os erros são internos e mapeados para os canônicos
  já existentes; o erro bruto do SDK **nunca** vaza para o domínio ou para o frontend.
- Todos os códigos da matriz existem no catálogo canônico; nenhum ficou "a definir".
