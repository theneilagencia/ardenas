# ARDEN-BE-008.1 — relatório de contratos e arquitetura do provider Anthropic

Transforma a recomendação documental (008) em **decisão técnica verificável + contratos internos
implementáveis**, sem tornar o provider executável. Nada de SDK instalado, nada de rede, nada de
segredo real, nada de Prisma/migração/OpenAPI/worker/frontend alterados. Provider permanece
`CONTRACT_ONLY` / `DISABLED`.

## 1. Escopo entregue

| Bloco | Entregue |
| --- | --- |
| Verificação externa oficial | Fontes lidas do registry npm + `.d.ts` de `@anthropic-ai/sdk@0.115.0` |
| Decisão técnica final | `ANTHROPIC_PROVIDER_DECISION_VERIFIED.md` (CONDITIONALLY_CONFIRMED) |
| Contratos/tipos canônicos | `src/contracts/model-providers/anthropic/*` (chaves, catálogo, capabilities, rate cards, credencial, conexão, config de modelo, erros) |
| Catálogo de provider/modelos | allowlist fechada, snapshots datados, DISABLED |
| Rate cards versionados | schema BigInt (minor units) + catálogo **vazio** (preço não verificado) |
| Erros + retry | matriz de erro → códigos canônicos existentes; política de retry conservadora |
| Interfaces de adapter/transporte | `apps/api/src/agents/providers/anthropic/*` — tipos + mappers PUROS |
| Contratos de credencial | write-only (metadados sem `apiKey`) |
| Testes contratuais | 34 testes (contracts + mappers + safety) |
| Documentação | 12 docs `ANTHROPIC_*` + este relatório + evidência de testes |

## 2. Contratos canônicos (`src/contracts/model-providers/anthropic/`)

- **`anthropic-provider-keys.ts`** — `ANTHROPIC_PROVIDER_KEY='anthropic.direct'`,
  `ANTHROPIC_PROVIDER_VERSION='1'`, `ANTHROPIC_CONNECTOR_KEY='system.anthropic'`,
  `ANTHROPIC_OFFICIAL_BASE_URL='https://api.anthropic.com'`,
  `ANTHROPIC_IMPLEMENTATION_STATUS='CONTRACT_ONLY'`, e
  `ANTHROPIC_PROVIDER_DEFINITION_CONTRACT` (`status='DISABLED'`, `productionAllowed=false`,
  `capabilities=['STRUCTURED_OUTPUT']`).
- **`anthropic-model-catalog.schema.ts`** — `commercialModelCatalogEntry` (zod) + catálogo de 3
  snapshots datados VERIFIED (`claude-opus-4-5-20251101`, `claude-sonnet-4-5-20250929`,
  `claude-haiku-4-5-20251001`), todos DISABLED, limites `null`, `rateCardKey=null`. Helpers
  `ANTHROPIC_ALLOWED_MODEL_IDS` e `isAllowedAnthropicModelId()`.
- **`anthropic-rate-card.schema.ts`** — `commercialModelRateCardDefinition` (preços em minor
  units via `z.bigint()`), `ANTHROPIC_RATE_CARDS` **vazio**, e
  `estimateComponentCostMinor(tokens, ratePerMillionMinor): bigint` (ceil inteiro, sem float).
- **`anthropic-credential.schema.ts`** — `anthropicCredentialInput` (`apiKey`, write-only) e
  `anthropicCredentialMetadata` (`fingerprint`, `status`, `createdAt` — **sem** `apiKey`).
- **`anthropic-connection.schema.ts`** — `anthropicConnectionConfiguration`
  (`baseUrlMode` literal `'OFFICIAL'`, `timeoutMs`, `maximumRetries`, `regionPolicy?`).
- **`anthropic-model-configuration.schema.ts`** — `anthropicModelParameters` +
  `assertAllowedAnthropicModelId()`.
- **`anthropic-errors.ts`** — `ANTHROPIC_ERROR_MATRIX` (classes do SDK → códigos canônicos
  **existentes**: `MODEL_PROVIDER_ERROR`, `MODEL_RATE_LIMITED`, `MODEL_CONTENT_FILTERED`,
  `MODEL_RESULT_UNKNOWN`, `AGENT_TIMEOUT`) + `mapAnthropicErrorClass()`. Nenhum código novo →
  OpenAPI sem diff.
- **`index.ts`** — barrel; reexportado por `src/contracts/index.ts` **sem** tocar `registry.ts`
  (por isso o OpenAPI gerado não muda).

## 3. Adapter puro (`apps/api/src/agents/providers/anthropic/`)

Somente **tipos de transporte internos** e **mappers puros** — nenhum client HTTP/SDK, nenhum
`AnthropicModelProvider` executável, nenhum `fetch`/`axios`.

- **`anthropic-transport.types.ts`** — tipos internos do envelope Messages (request/response/
  message/tool/usage/error/stop reason). Nenhum tipo do SDK escapa.
- **`anthropic-request-mapper.ts`** — `ModelGenerationRequest` → `AnthropicTransportRequest`:
  `system` separado das messages; rejeita `modelId` fora da allowlist; structured output via
  **tool sintética forçada** (`arden_structured_output`, `tool_choice={type:'tool'}`); nenhum
  `organizationId`/credencial/baseURL/segredo no payload.
- **`anthropic-response-mapper.ts`** — `AnthropicTransportResponse` → `ModelGenerationResult`:
  tabela StopReason VERIFIED → `finishReason`; `cache_read_input_tokens` → `cachedInputTokens`
  (cache-creation **não** é dobrado); `usage` carrega `providerKey`+`modelId`; `providerRequestId`
  fica no resultado (runtime persiste só hash).
- **`anthropic-error-mapper.ts`** — classe de erro → `AnthropicMappedError` (código canônico,
  `retryable`, `unknown`, `retryAfterMs`).
- **`anthropic-retry-policy.ts`** — `decideAnthropicRetry()` (não-retryable → não; incerto →
  `uncertain_result_not_retried`; teto de tentativas; deadline) + `computeAnthropicBackoffMs()`
  (exponencial, honra Retry-After, com teto). `ANTHROPIC_RETRY_DEFAULT`.
- **`index.ts`** — barrel só de tipos/mappers puros.

## 4. Invariantes de segurança preservados

- **Sem SDK**: nenhum `@anthropic-ai/sdk` (nem qualquer SDK comercial) em nenhum `package.json`;
  `package-lock.json` intocado. Guard automatizado no teste de safety.
- **Sem rede**: nenhum `fetch`/`http(s)`/`axios`/import de SDK nos fontes do adapter (guard).
- **Provider não executável**: sem arquivo `anthropic-model-provider.ts`/`*-http-client.ts`/
  `*-sdk-client.ts`; definição `DISABLED`; não registrado no runtime.
- **Credencial write-only**: metadados nunca expõem `apiKey`.
- **Base URL travada**: só `OFFICIAL` aceito.
- **Custo desconhecido nunca é zero**: rate cards vazios → estimador retorna `null` a montante;
  `0n` só para rate conhecido igual a zero.
- **Sem preço/limite/retention inventado**: valores não verificados ficam `null`/vazios/UNVERIFIED.

## 5. Fora de escopo (008.2+)

Chamada real à API, client HTTP/SDK, provider executável, armazenamento real de credencial,
smoke test real, tool calling funcional, rate cards com preço, mudança de status para ACTIVE,
frontend, migração, worker. Todos dependem de leitura direta das páginas oficiais de pricing e
governança (hoje 403).
