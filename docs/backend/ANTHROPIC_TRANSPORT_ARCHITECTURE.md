# Anthropic — arquitetura de transporte (ARDEN-BE-008.3)

> O SDK é isolado atrás de uma **porta de transporte** interna. Nenhum tipo do SDK escapa da
> fronteira; o provider e os mappers só conhecem tipos internos
> (`AnthropicTransportRequest/Response`). Duas implementações: real (SDK) e fake (offline).

## 1. Porta de transporte (`anthropic-transport.port.ts`)

| Elemento | Valor |
| --- | --- |
| Interface | `AnthropicTransport.createMessage(request, context)` |
| Token DI | `ANTHROPIC_TRANSPORT` |
| Contexto | `AnthropicTransportExecutionContext = { apiKey, timeoutMs, maximumRetries, signal?, correlationId }` |
| Exceção | `AnthropicTransportException` → carrega `AnthropicTransportError` |
| Erro | `AnthropicTransportError = { providerErrorClass, httpStatus, retryAfterMs, phase }` |

`apiKey` vive **apenas em memória** no contexto de execução: nunca é persistido, retornado
nem logado. `phase ∈ { BEFORE_SEND, AFTER_SEND }` distingue falha antes/depois do envio
(base para retry seguro vs. resultado incerto — ver `ANTHROPIC_RUNTIME_RETRY.md`).

## 2. Fronteira do SDK (VERIFIED)

O SDK `@anthropic-ai/sdk` é importado **exclusivamente** em:

```
apps/api/src/agents/providers/anthropic/sdk/anthropic-sdk-transport.ts
```

Nenhum outro arquivo de produção importa o SDK. Nenhum tipo do SDK cruza a porta: request e
response entram/saem como tipos internos. Enforçado por:

- `anthropic-sdk-boundary.spec.ts` (teste de arquitetura) — só `sdk/` pode importar o pacote;
- a guarda de dependência do 007.3 atualizada.

## 3. `AnthropicSdkTransport` — transporte real

- cria o client do SDK **por chamada** — sem singleton global, sem key em cache, sem
  compartilhamento entre tenants;
- `baseURL` travada na oficial `https://api.anthropic.com`;
- `maxRetries = 0` no SDK (o retry é do adapter, não do SDK — ver retry doc);
- timeout vindo do contexto; `AbortSignal` do contexto ligado ao client;
- **gate de rede**: se `ANTHROPIC_PROVIDER_EXTERNAL_CALLS_ENABLED=false`, lança **sem** criar
  o client e **sem** tocar a rede;
- falhas de conexão são reportadas conservadoramente como `phase = AFTER_SEND`.

## 4. `FakeAnthropicTransport` — transporte offline

Determinístico, **sem SDK e sem rede**, com os mesmos tipos internos. 16 cenários e fila de
cenários (para exercitar retry). Detalhe em `ANTHROPIC_OFFLINE_TEST_TRANSPORT.md`. Registra a
contagem de chamadas e o **comprimento** da apiKey recebida (nunca o valor).

## 5. Seleção por composição (ARCHITECTURAL_DECISION)

Qual transporte é injetado é decidido na **composição do módulo**, por `NODE_ENV`: em ambiente
de teste, o fake; nunca em produção. Não há header/query/flag de request que troque o
transporte — não existe backdoor de runtime.

## 6. PROIBIDO

- importar `@anthropic-ai/sdk` fora de `sdk/anthropic-sdk-transport.ts`;
- vazar qualquer tipo do SDK através da porta;
- override de base URL / headers / proxy / beta / versão / auth do client;
- client global reutilizado entre chamadas ou tenants;
- deixar o retry do SDK ligado (`maxRetries > 0`).
