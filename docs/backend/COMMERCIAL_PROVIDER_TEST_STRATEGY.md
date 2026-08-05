# Estratégia de teste do provider comercial (ARDEN-BE-008, auditoria)

> Doc de AUDITORIA (sem código). Como testar o primeiro provider comercial (candidato
> líder: Anthropic Claude) **sem** acoplar a suíte à internet nem gastar crédito real em CI.
> Três camadas; a suíte normal NUNCA depende de rede. Espelha o padrão do provider interno
> determinístico (`INTERNAL_TEST_MODEL_PROVIDER.md`): sem SDK, sem internet, sem segredo.

## Camada 1 — Unit (SDK totalmente mockado)

SDK do provider **totalmente mockado**; nenhuma chamada real. Cobre o mapeamento
provider ↔ runtime:

- **request mapping**: `ModelGenerationRequest` → payload do SDK (system instructions,
  mensagens, tools com alias/description/schema, schema de saída, params); confirma que
  segredo/endpoint/credencial de tool **não** entram no payload;
- **response mapping**: resposta do SDK → `ModelGenerationResult` (output, `finishReason`,
  `usage`);
- **erros**: cada linha de `COMMERCIAL_PROVIDER_ERROR_AND_RETRY_MODEL.md` → código canônico
  correto (`MODEL_RATE_LIMITED`, `MODEL_PROVIDER_ERROR`, `MODEL_CONTENT_FILTERED`,
  `MODEL_RESULT_UNKNOWN`, `AGENT_TIMEOUT`) e `retryable` esperado;
- **usage**: tokens input/output/cached mapeados corretamente;
- **tool calls**: `finishReason = TOOL_CALL` → toolCalls estruturadas (revalidadas depois
  pelo gate);
- **structured output**: `finishReason` e output aderente ao schema; output inválido nunca
  vira SUCCEEDED.

Determinístico, offline, sem relógio real (timeout simulado como no BE-007.3).

## Camada 2 — Integração local (transporte fake, SEM internet)

Servidor HTTP fake / adaptador de transporte injetado no SDK; **nenhuma saída de rede**.
Cobre o caminho de transporte que o mock unitário não exercita:

- **timeouts**: transporte que não responde → `AbortSignal` dispara → `AGENT_TIMEOUT`
  (antes do envio) ou `MODEL_RESULT_UNKNOWN` (pós-envio incerto);
- **retries**: 429/5xx do servidor fake → classificação retryável + backoff do motor do
  BE-005; 4xx/content filter → não retryável;
- **respostas malformadas**: corpo ilegível/parcial → FAILED sem SUCCEEDED; resposta acima
  do cap de tamanho → FAILED;
- **connection reset / envio incerto** → UNKNOWN, sem retry automático e sem duplicação.

Roda em CI normal, offline. Sem credencial real, sem host externo.

## Camada 3 — Smoke test controlado (credencial e chamada reais)

Uma verificação mínima de que o SDK/endpoint/modelo reais funcionam ponta a ponta.

- **desligado por padrão**; habilitado manualmente (flag/env explícita);
- **fora do CI de PR público** — nunca roda em PR aberto;
- **credencial real** de um projeto de teste, resolvida do cofre; **nunca** commitada;
- **custo controlado**: modelo/tokens mínimos, uma chamada;
- **sem dados reais de cliente** — apenas prompt sintético;
- valida request/response reais e o mapeamento de `usage`/`finishReason`.

## Invariante

- A **suíte normal (unit + integração) NUNCA depende da internet** nem de crédito do
  provider; é 100% determinística e offline.
- O provider comercial só é registrado via `InMemoryModelProviderRegistry.register()`; o
  gate `productionAllowed` recusa providers não permitidos em `NODE_ENV=production` — os
  testes usam o provider real atrás da abstração ou fakes, nunca texto livre.
- Testes seguem os mesmos canários de segredo do BE-006/007: nenhuma key aparece em
  request mapeado, log ou evidência.

## REQUER VERIFICAÇÃO EXTERNA (na implementação)
- forma exata de injetar um transporte/base URL fake no SDK do provider (camada 2);
- nome do pacote/SDK e do endpoint reais para o smoke test (camada 3);
- credencial de projeto de teste dedicada, com teto de custo próprio.
