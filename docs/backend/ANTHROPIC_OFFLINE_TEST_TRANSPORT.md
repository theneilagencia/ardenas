# Anthropic — transporte de teste offline (ARDEN-BE-008.3)

> O `FakeAnthropicTransport` executa o provider **inteiramente offline**: sem SDK, sem rede,
> determinístico. A suíte nunca depende da internet. O ambiente de teste seleciona o fake por
> **composição** (não por header/query). Fonte: `anthropic-fake-transport.ts`.

## 1. Fake transport (VERIFIED)

- mesmos tipos internos da porta (`AnthropicTransportRequest/Response`), **sem** SDK/rede;
- determinístico e offline;
- registra a contagem de chamadas e o **comprimento** da apiKey recebida (nunca o valor);
- suporta `AbortSignal` e uma **fila de cenários** (para exercitar retry: cenário por tentativa).

## 2. Os 16 cenários

| Grupo | Cenários |
| --- | --- |
| sucesso/estrutura | `structured_success`, `structured_invalid`, `structured_repairable`, `max_tokens` |
| erros de API | `rate_limit`, `authentication_error`, `permission_error`, `invalid_request`, `not_found`, `overloaded`, `internal_error` |
| incerteza/rede | `timeout_before_send`, `timeout_after_send`, `connection_reset`, `malformed_response`, `aborted` |

`timeout_before_send` → seguro retriar; `timeout_after_send` / `connection_reset` /
`malformed_response` → `MODEL_RESULT_UNKNOWN` (nunca sucesso, nunca retry). Ver
`ANTHROPIC_RUNTIME_RETRY.md`.

## 3. Guarda de rede

Os testes rodam com uma guarda de rede: qualquer tentativa de chamada externa real falha o
teste. Combinado com o gate `ANTHROPIC_PROVIDER_EXTERNAL_CALLS_ENABLED=false` no transporte
real, garante suíte 100% offline.

## 4. Seleção por composição (ARCHITECTURAL_DECISION)

Em `NODE_ENV === 'test'` a composição do módulo injeta o fake no token `ANTHROPIC_TRANSPORT`;
em produção, nunca. **Não** há header, query param ou flag de request que troque o transporte —
não existe backdoor de runtime para forçar o fake ou pular o gate.

## 5. E2E offline do worker + override test-only

O E2E de runtime exercita o worker de ponta a ponta **offline** (fake transport + guarda de
rede). O provider persistido permanece `DISABLED`; o E2E usa um override **test-only** da linha
do provider no DB para permitir o fluxo — o catálogo persistido **não** é alterado para simular
execução.

## 6. NUNCA

- registrar o valor da apiKey (só o comprimento);
- selecionar o transporte por header/query/flag de request;
- deixar um teste tocar a rede real;
- alterar o catálogo persistido para simular execução (usar o override test-only).
