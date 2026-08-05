# Anthropic — erros em runtime (ARDEN-BE-008.3)

> Como o adapter converte a falha de transporte em código canônico `MODEL_*`/`AGENT_*`.
> Reusa a matriz verificada do 008.1 (`ANTHROPIC_ERROR_MAPPING.md`); esta fase apenas a
> executa. Nenhum código canônico novo. Fonte: `anthropic-error-mapper.ts`.

## 1. Da falha de transporte ao código canônico

O transporte devolve `AnthropicTransportError` (`providerErrorClass`, `httpStatus`,
`retryAfterMs`, `phase`). O mapper converte para o catálogo canônico existente:

| Falha | HTTP | Código Arden | Retry | UNKNOWN |
| --- | --- | --- | --- | --- |
| request inválido / auth / permissão / not found | 400/401/403/404 | `MODEL_PROVIDER_ERROR` | não | não |
| schema-invalid (pré-envio) | — | `MODEL_PROVIDER_ERROR` (request inválido) | não | não |
| rate limit | 429 | `MODEL_RATE_LIMITED` | sim (`Retry-After`) | não |
| overload / 5xx | 5xx | `MODEL_PROVIDER_ERROR` | sim (backoff) | condicional |
| abort / cancelamento | — | `AGENT_TIMEOUT` (abort) | não | não |
| timeout ANTES do envio (`phase=BEFORE_SEND`) | — | `AGENT_TIMEOUT` | sim (não saiu) | não |
| timeout APÓS envio / conexão caiu após envio / response malformada | — | `MODEL_RESULT_UNKNOWN` | **não** | **sim** |
| `refusal` (content filter) | — | `MODEL_CONTENT_FILTERED` | não | não |

UNKNOWN nunca vira sucesso e nunca é retriado (ver `ANTHROPIC_RUNTIME_RETRY.md`).

## 2. Mensagem pública vs. interna (VERIFIED)

- o erro bruto do SDK é **capturado na fronteira** e convertido; **nunca** vaza para o domínio
  nem para o frontend;
- a mensagem pública é o código canônico + texto seguro; a mensagem interna (evidência/log)
  **nunca** contém: a API key, o corpo do request/response, as instruções de sistema, headers
  de auth, ou o objeto de erro cru do SDK;
- nenhum código público novo — todos os erros mapeiam para os canônicos já existentes.

## 3. Conjuntos retry / no-retry

Detalhe em `ANTHROPIC_RUNTIME_RETRY.md`. Resumo:

- **retry**: rate limit (429), overload/5xx, falha pré-envio (`BEFORE_SEND`);
- **no-retry**: auth, permissão, invalid, not found, abort, schema-invalid, UNKNOWN.

## 4. NUNCA

- vazar o erro cru do SDK para o domínio ou frontend;
- incluir key/corpo/system/headers/erro cru na mensagem ou na evidência;
- inventar código canônico novo;
- tratar UNKNOWN como sucesso ou retriá-lo.
