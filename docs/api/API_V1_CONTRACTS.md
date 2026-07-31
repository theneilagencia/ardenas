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
