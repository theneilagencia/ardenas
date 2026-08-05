# Anthropic — retry em runtime (ARDEN-BE-008.3)

> O retry é **do adapter**, não do SDK (`maxRetries=0`). Implementa a política descrita em
> `ANTHROPIC_RETRY_AND_UNKNOWN.md`. Backoff + jitter + `Retry-After` + deadline. Resultado
> incerto (UNKNOWN) **nunca** é retriado. Fonte: `anthropic-retry-policy.ts`.

## 1. Retry do adapter (VERIFIED)

- o SDK roda com `maxRetries = 0`: o auto-retry do SDK está **desligado**;
- o adapter possui a política — porque conhece idempotência de efeitos, deadline/lease do job
  e a invariante de resultado incerto, que o SDK não conhece;
- **backoff exponencial + jitter**; honra `Retry-After` no 429;
- teto de tentativas + **deadline global** do passo; sem espera ativa (`sleep`);
- `AbortSignal` ligado ao timeout; abort = não-retry.

## 2. Retry vs. no-retry

| Retriável | Não-retriável |
| --- | --- |
| rate limit (429, honra `Retry-After`) | auth / permissão / invalid / not found |
| overload / 5xx (backoff) | abort / cancelamento |
| falha **pré-envio** (`phase=BEFORE_SEND`) | schema-invalid |
| | **UNKNOWN** (resultado incerto) |

## 3. Fase antes/depois do envio (ARCHITECTURAL_DECISION)

`AnthropicTransportError.phase` distingue:

- **`BEFORE_SEND`**: request não saiu → seguro retriar (não há efeito possível);
- **`AFTER_SEND`**: request pode ter sido recebido → **incerto**.

O transporte real reporta falhas de conexão conservadoramente como `AFTER_SEND`.

## 4. UNKNOWN nunca é retriado

Vira `MODEL_RESULT_UNKNOWN` (runtime code) e **nunca** sucesso, **nunca** retry cego:

- timeout **depois** do envio;
- conexão caiu **depois** do envio;
- response malformada / ilegível após envio.

Ao classificar UNKNOWN: persistir o usage já conhecido (nunca fabricar), preservar evidência,
e deixar a governança decidir (`unknownResultBehavior`: FAIL/SUSPEND). O recorder nunca marca
UNKNOWN como PASSED (BE-007.6).

## 5. Deadline efetivo

Timeout efetivo de cada chamada = **mínimo** de: deadline do passo e timeout de conexão.
Nenhuma tentativa pode ultrapassar o lease do job.

## 6. NUNCA

- ligar o retry do SDK (`maxRetries > 0`);
- retriar UNKNOWN, abort, auth, permissão, invalid, not found ou schema-invalid;
- retriar `AFTER_SEND` como se fosse seguro;
- espera ativa (`sleep`) ou ignorar `Retry-After` / o deadline do passo.
