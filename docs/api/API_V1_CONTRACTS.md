# Arden.AS — API v1 · Contratos (ARDEN-FE-003)

> Referência dos modelos e comandos. Fonte executável: `src/contracts/**` (schemas
> Zod; tipos derivados por `z.infer`). Geração do OpenAPI: `npm run contracts:openapi`.

## Pacote de contratos

```
src/contracts/
├── common/        api-error · pagination · request-context · identifiers · timestamps
├── session/       session.schemas · session.contract
├── operations/    operations.schemas · operations.contract
├── operation-versions/  operation-versions.schemas · operation-versions.contract
├── authority/     authority.schemas · authority.contract
├── audit/         audit.schemas · audit.contract
├── openapi/       build-openapi · validate-openapi
├── endpoint.ts    descritor declarativo de endpoint
├── registry.ts    schemas + endpoints (fonte única do OpenAPI)
└── index.ts
```

Independente do frontend: **não** importa React, Zustand nem IndexedDB (garantido por
teste). Tipos derivados dos schemas — sem duplicação manual desnecessária.

## Comuns

- **Envelope**: `ApiResponse<T> = { data, meta? }`. **Lista**: `PaginatedResponse<T> =
  { data[], pagination }` por **cursor** (`{ cursor?, nextCursor, hasNextPage, limit }`).
- **Erro**: `ApiErrorResponse = { error: { code, message, correlationId, details?,
  fieldErrors? } }` (ver `API_V1_ERROR_CATALOG.md`).
- **Timestamps**: ISO 8601 UTC (`isoUtcDateTime`). **Money**: `{ amountMinor, currency }`.
- **IDs**: opacos (strings sem semântica).
- **Contexto derivado (servidor)**: `ServerRequestContext = { userId, organizationId,
  correlationId, permissions }` — **derivado da sessão**, nunca enviado pelo cliente.

## Sessão

`SessionContext = { user, organizations[], memberships[], activeOrganizationId,
permissions[], expiresAt, status }`. `status ∈ authenticated|expired|suspended|
no_organization`. `SwitchOrganizationRequest = { organizationId }` (única presença
legítima de `organizationId` em body — comando de sessão, validado contra memberships).

## Operações

`Operation = { id, organizationId, name, description|null, status, currentDraftVersionId|null,
publishedVersionId|null, ownerId|null, createdBy, createdAt, updatedAt, revision }`.
`status ∈ draft|active|paused|archived`. Requests: `CreateOperationRequest` (name,
description?, ownerId?, sourceAssessmentId?, clientReference?), `UpdateOperationRequest`
(+expectedRevision), `Duplicate/Archive/Transition`. **Criar** cria operação + 1ª versão
+ auditoria (transacional). Nenhum request de operação aceita `organizationId`.

## Versões

`OperationVersion = { id, operationId, organizationId, versionNumber, status, definition,
authorityProfile, changeSummary|null, createdBy, createdAt, updatedAt, publishedBy|null,
publishedAt|null, revision }`. `status ∈ draft|published|superseded`. **Imutável** após
publicação (PATCH só em draft; publicada → `ALREADY_PUBLISHED`). `CreateOperationVersionRequest
= { basedOnVersionId?, changeSummary? }`. `PublishOperationVersionRequest = { expectedRevision,
changeSummary }`.

`OperationDefinition = { objective, expectedResult, triggers[], steps[], actions[],
approverIds[], contextSourceIds[], integrationIds[], completionCriteria[], environment|null,
evidencePolicy|null }`. `OperationStep`/`OperationAction` espelham o domínio. Campos ricos
adicionais: **DECISÃO PENDENTE (D-005)**.

## Gradiente de Autoridade

`AuthorityProfile = { level(1..5), allowedActions[], approvalRequired, approvalPolicyId|null,
financialLimit: Money|null, destructiveActionsAllowed, justificationRequired }`.
`AuthorityAction = { key, semanticLevel, destructive }`. Mapeamento
semântico↔numérico: `observe=1 … blocked=5`. **Regras mínimas** de publicação
(`publishableAuthorityProfile`): ação destrutiva nunca abaixo de `execute_with_approval`
e apenas quando o perfil permite destrutivas. O backend é a autoridade final.

## Auditoria (somente leitura)

`AuditEvent = { id, organizationId, actor{ id, type, role|null, displayName|null },
action, resourceType, resourceId, occurredAt, correlationId, source, before|null,
after|null, metadata }`. Filtros: actorId, action, resourceType, resourceId, from, to,
correlationId, cursor, limit. **Sem** `POST/PATCH/DELETE` público.

## ARDEN-BE-006 — Connectors and External Tools (contratado)

Contratos compartilhados em `src/contracts/connectors/*` (schemas Zod), registrados
em `src/contracts/registry.ts` e projetados no OpenAPI (`docs/api/openapi-v1.yaml`,
tag `Connectors`). **Os endpoints estão contratados, porém ainda NÃO operacionais** —
a persistência, o cofre de credenciais, o cliente HTTP seguro e os webhooks funcionais
chegam nas fases 006.3+.

- **Catálogo canônico** (híbrido): fonte em código `connector-catalog.ts` (conectores
  `system.http`, `system.webhook`, `internal.test` + ferramentas), validada pelos
  schemas; projeção idempotente para o banco preparada como função pura
  (`projectConnectorCatalog()`), sem persistir nesta fase.
- **Segurança contratual:** requests sensíveis (segredo de credencial, `signingSecret`)
  são **write-only** e distintos das responses; nenhuma resposta declara
  `secret/ciphertext/nonce/authTag/pathTokenHash`. O token de webhook e o segredo de
  assinatura são retornados **uma única vez** na criação (`WebhookEndpointSecret`).
- **Action keys externas:** `external.http.request`, `external.webhook.send`,
  `connector.test.{echo,failure,timeout}` — namespace próprio, sem alterar os
  executores determinísticos do BE-005.
- **Política de rede** (`ConnectorNetworkPolicy`): defaults de produção restritivos
  (só `https`, sem redirects, sem redes privadas/loopback/link-local). Enforcement de
  SSRF é fase futura (só o contrato aqui).

## ARDEN-BE-007 — Agents and Model Runtime

Contratos compartilhados em `src/contracts/agents/*` (schemas Zod), registrados em
`src/contracts/registry.ts` e projetados no OpenAPI (`docs/api/openapi-v1.yaml`, tag
`Agents`). **Esta fase define contratos.** Persistência, runtime e frontend NÃO existem
ainda; execução direta de agentes NÃO existe.

- **Domínio canônico:** `AgentDefinition` (tenant-scoped, `status`+revision, `REVOKED`
  terminal) e `AgentVersion` (DRAFT→PUBLISHED→RETIRED, imutável após publicação). Objetivo,
  `systemInstructions` e TODAS as políticas pertencem à VERSÃO — nunca ao request de execução.
- **Provider substituível:** `ModelProviderDefinition` (catálogo inicial: apenas
  `internal.test-model`, `productionAllowed=false`). `ModelConfiguration` fixa provider +
  `modelId` + credencial (referência ao cofre) — resposta nunca inclui segredo.
- **Políticas versionadas:** contexto (allowlist fechada), execução (limites; sem loop
  infinito), ferramentas (aliases allowlistados; destrutivo/financeiro/crítico `false` por
  default), avaliação (determinística obrigatória; judge advisory), custo (enforcement futuro).
- **Structured output obrigatório:** `AGENT_OUTPUT_INVALID` nunca vira sucesso silencioso.
- **Tipos internos sem SDK:** `ModelGenerationRequest/Result`, mensagens, tool defs/calls —
  nenhum import de Anthropic/OpenAI/Bedrock/Vertex. Interfaces arquiteturais
  (`ModelProvider`, `ModelProviderRegistry`, `AgentContextAssembler`, `AgentOutputValidator`,
  `AgentEvaluator`, `AgentRuntime`) + tokens de DI, sem implementação.
- **Action key:** `agent.execute` (única) no `executorActionKey` do BE-005; `operationStep.agent`
  espelha `operationStep.tool`. Sem `model.generate`/`chat`/`agent.run`.
