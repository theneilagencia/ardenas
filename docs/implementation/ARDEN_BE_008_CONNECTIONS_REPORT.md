# ARDEN-BE-008.2B — relatório de infraestrutura administrativa do provider Anthropic

Converte a decisão do gate 008.2A em **infraestrutura administrativa persistida** para o provider
Anthropic (`anthropic.direct`), **sem torná-lo executável**. Nenhum SDK instalado, nenhuma chamada
real, nenhum client HTTP, nenhum segredo real ao provider. Provider e modelos permanecem `DISABLED`;
`productionAllowed=false`. A ausência de verificação oficial (pricing/governança, gate 008.2A) **não**
é convertida em aceitação — ver `ARDEN_BE_008_EXTERNAL_VERIFICATION_GATE.md`.

## 1. Objetivo

Entregar connector + connection + credencial (vault) + catálogo de modelos persistido + ciclo de vida
de `ModelConfiguration` para o provider comercial, reusando integralmente BE-006/BE-007, com a menor
superfície nova possível e **sem caminho de execução**. Estado-alvo: um operador administrativo
consegue registrar a conexão, gravar a credencial, validá-la **localmente** e **preparar** (DRAFT) uma
configuração de modelo — mas **não** ativá-la nem executá-la.

## 2. Reutilizado sem alteração (VERIFIED)

Nenhum destes blocos foi modificado; o provider comercial **não** relaxa nenhuma invariante.

| Bloco reutilizado | Artefato |
| --- | --- |
| Cofre de credenciais (AES-256-GCM) | `apps/api/src/connectors/credentials/*` (BE-006.4) |
| Ciclo de vida de conexão | `apps/api/src/connectors/connections/connections.service.ts` |
| Versões / rotação / revogação de credencial | `connection_credential_versions` + serviço de credenciais |
| Ciclo de vida de `ModelConfiguration` | `apps/api/src/agents/model-configurations/model-configurations.service.ts` |
| Idempotência (Idempotency-Key) | middleware/serviço de idempotência (BE-003/006) |
| Concorrência otimista (`expectedRevision`) | serviços de conexão/model-config |
| Auditoria transacional | pipeline de audit events existente |
| Tenant scoping | `organizationId` da sessão; cross-tenant → 404 |
| Pipeline OpenAPI | `src/contracts/registry.ts` → `npm run contracts:openapi` |

## 3. Adicionado (ARCHITECTURAL_DECISION / CONDITIONALLY_AVAILABLE)

| Novo artefato | Path | Estado |
| --- | --- | --- |
| Categoria `MODEL_PROVIDER` + connector `system.anthropic` | `src/contracts/connectors/connector-catalog.ts` | `ACTIVE`, sem ferramentas |
| Provider `anthropic.direct@1` (definição persistível) | `src/contracts/model-providers/anthropic/*` + `project-model-providers.ts` | `DISABLED`, `productionAllowed=false` |
| Tabela `model_catalog_entries` + enum `ConnectorCategory.MODEL_PROVIDER` | `apps/api/prisma/migrations/20260803140219_anthropic_connection_catalog` | migração aditiva |
| Projector idempotente de catálogo de modelos | `apps/api/src/agents/providers/project-model-catalog.ts` | 3 snapshots `DISABLED` |
| Fix: projector de providers honra o status canônico | `apps/api/src/agents/providers/project-model-providers.ts` | comercial entra `DISABLED` |
| Endpoint de validação local de configuração de conexão | `apps/api/src/connectors/connections/connections.controller.ts` + `.service.ts` | `connection.test` |
| Endpoint de leitura do catálogo de modelos | `apps/api/src/agents/providers/model-providers.controller.ts` | `model_provider.view` |
| Serviço de validação de `ModelConfiguration` Anthropic | `apps/api/src/agents/model-configurations/anthropic-configuration-validation.service.ts` | strict params + modelId allowlist |

### 3.1 Endpoints v1 novos (aditivos ao OpenAPI — 98 paths)

- **`POST …/connections/{connectionId}/validate-configuration`** — permissão `connection.test`.
  Request `ValidateConnectionConfigurationRequest` (`note?`). Response
  `ConnectionConfigurationValidationResponse` (`connectionId`, `configurationValid`,
  `credentialPresent`, `credentialDecryptable`, `providerCompatible`, `providerVerificationStatus`,
  `credentialFingerprint`, `issues[]`, `validatedAt`). Validação **exclusivamente LOCAL**: decifra a
  credencial no cofre, confere compatibilidade com o provider e devolve o fingerprint — **nunca**
  contata o provider (`providerVerificationStatus` é sempre `NOT_VERIFIED_WITH_PROVIDER`) e **nunca**
  devolve segredo.
- **`GET /api/v1/model-providers/{providerKey}/versions/{providerVersion}/models`** — permissão
  `model_provider.view`. Response `ModelCatalogListResponse` (array das entradas persistidas de
  `model_catalog_entries`). Todos os modelos Anthropic `DISABLED`; **sem** segredo, **sem** preço.

### 3.2 Serviço de validação de configuração de modelo

`AnthropicConfigurationValidationService` (no-op se o provider não for `anthropic.direct`): rejeita
`modelId` fora do allowlist (`isAllowedAnthropicModelId`) e `parameters` fora do schema discriminado
estrito (`anthropicModelParameters` — rejeita `model/apiKey/baseUrl/headers/tools/system/
organizationId/timeout/retry`). DRAFT de `ModelConfiguration` Anthropic é **preparável**; a **ativação
é bloqueada** com `MODEL_PROVIDER_DISABLED`. Sem SDK, sem rede, sem segredo.

## 4. Invariantes de segurança preservados (VERIFIED)

- **Sem SDK / sem rede / sem execução**: nenhum `@anthropic-ai/sdk`; nenhum client HTTP; provider não
  registrado no runtime; nenhum arquivo `*-model-provider.ts`/`*-http-client.ts`.
- **Provider e modelos `DISABLED`**: projectors honram o status canônico; ativação de config →
  `MODEL_PROVIDER_DISABLED`.
- **Credencial write-only**: gravação via cofre AES-256-GCM; respostas só metadados/fingerprint;
  `validate-configuration` **nunca** devolve segredo (canário de vault no teste de integração).
- **Validação sem provider**: `providerVerificationStatus = NOT_VERIFIED_WITH_PROVIDER` sempre.
- **Sem preço inventado**: nenhum rate card comercial persistido (pricing UNVERIFIED, gate 008.2A).
- **Tenant scoping**: recurso de outro tenant → `RESOURCE_NOT_FOUND` (404).
- **Sem código/erro novo**: reusa `connection.test`, `model_provider.view`, `connection.*`,
  `model_configuration.*`; reusa `MODEL_PROVIDER_DISABLED`, `VERSION_CONFLICT`, `RESOURCE_NOT_FOUND`,
  `VALIDATION_ERROR`, `IDEMPOTENCY_CONFLICT`. OpenAPI apenas **aditivo** (2 paths).

## 5. Migração Prisma (aditiva)

`20260803140219_anthropic_connection_catalog`: adiciona `ConnectorCategory.MODEL_PROVIDER` e a tabela
`model_catalog_entries`. **Nenhuma migração anterior foi alterada.** Seed idempotente: provider
`anthropic.direct` + 3 snapshots de modelo persistidos `DISABLED`; connector `system.anthropic`
`ACTIVE` (categoria `MODEL_PROVIDER`, sem ferramentas). Segunda execução do seed: providers/modelos
`+0`; provider permanece `DISABLED`.

## 6. Documentação de referência

A família `docs/backend/ANTHROPIC_*.md` (12 documentos) descreve os contratos congelados no 008.1 e a
verificação: `ANTHROPIC_CREDENTIAL_CONTRACT`, `ANTHROPIC_MODEL_CATALOG`, `ANTHROPIC_MODEL_CONFIGURATION`,
`ANTHROPIC_PROVIDER_DECISION_VERIFIED`, `ANTHROPIC_RATE_CARDS`, `ANTHROPIC_DATA_GOVERNANCE_VERIFIED`,
`ANTHROPIC_OFFICIAL_SOURCE_REGISTER`, `ANTHROPIC_ERROR_MAPPING`, `ANTHROPIC_REQUEST_RESPONSE_MAPPING`,
`ANTHROPIC_STRUCTURED_OUTPUT_MAPPING`, `ANTHROPIC_USAGE_MAPPING`, `ANTHROPIC_RETRY_AND_UNKNOWN`.

## 7. Fora de escopo (DEFERRED — 008.3+)

Instalação do SDK real; client HTTP/transporte real; provider executável e registrado no runtime;
chamada real à API; rate cards comerciais com preço verificado; ativação de `ModelConfiguration`
(`productionAllowed=true`); smoke test controlado; tool calling funcional; frontend funcional. Todos
dependem de leitura direta legítima das páginas oficiais de pricing e governança (hoje 403 — gate
008.2A UNVERIFIED) e de um ambiente restrito controlado.
