# Arden.AS — Mapa Frontend → API v1 (ARDEN-FE-003)

> Confronta o frontend existente (casos de uso e repositórios de ARDEN-FE-001/002)
> com os endpoints v1. Cobre todo o **primeiro fluxo**. Contrato atual =
> `src/services/contracts.ts` / `src/services/session/session-contracts.ts`.

## Primeiro fluxo (sessão → operação → versão → autoridade → publicação → auditoria)

| Ação da UI | Caso de uso (frontend) | Contrato atual | Endpoint v1 | Request | Response | Permissão |
|---|---|---|---|---|---|---|
| Carregar sessão | `TenantProvider` → `SessionRepository.getCurrentSession` | `SessionRepository` | `GET /session` | — | `SessionContext` | — |
| Trocar organização | `useTenant().switchOrganization` | `SessionRepository.switchOrganization` | `POST /session/switch-organization` | `SwitchOrganizationRequest` | `SessionContext` | — |
| Renovar sessão | `refreshSession` | `SessionRepository.refreshSession` | `POST /session/refresh` | — | `SessionContext` | — |
| Encerrar sessão | `signOut` | `SessionRepository.signOut` | `POST /session/logout` | — | 204 | — |
| Listar operações | `listOperations(ctx, query)` | `OperationsRepository.list` | `GET /organizations/{orgId}/operations` | `ListOperationsQuery` | `OperationListResponse` | `operation.view` |
| Abrir operação | `getOperation(ctx, id)` | `OperationsRepository.getById` | `GET …/operations/{operationId}` | — | `OperationResponse` | `operation.view` |
| Criar operação (wizard) | `createOperation(ctx, input)` | `OperationsRepository.create` | `POST …/operations` | `CreateOperationRequest` (+ Idempotency-Key) | `OperationResponse` (201; cria 1ª versão + auditoria, transacional) | `operation.create` |
| Editar metadados | `updateOperationDraft` (parcial) | `OperationsRepository.updateDraft` | `PATCH …/operations/{operationId}` | `UpdateOperationRequest` (+ If-Match) | `OperationResponse` | `operation.edit` |
| Criar versão | `createOperationVersion(ctx, id)` | `OperationsRepository.createVersion` | `POST …/versions` | `CreateOperationVersionRequest` (+ Idempotency-Key) | `OperationVersionResponse` | `operation.edit` |
| Editar rascunho da versão | `saveOperationDraft` / `updateOperationDraft` | `OperationsRepository.updateDraft` | `PATCH …/versions/{versionId}` | `UpdateOperationVersionRequest` (+ If-Match) | `OperationVersionResponse` | `operation.edit` |
| Definir Gradiente de Autoridade | (novo — GAP-11) | (não existe: autoridade por passo/ação) | `PATCH …/versions/{versionId}/authority` | `UpdateAuthorityProfileRequest` (+ If-Match) | `OperationVersionResponse` | `operation.edit` |
| Consultar gradiente | (leitura da matriz) | (display-only) | `GET …/versions/{versionId}/authority` | — | `AuthorityProfileResponse` | `operation.view` |
| Publicar versão | `publishOperationVersion(ctx, id)` | `OperationsRepository.publishVersion` | `POST …/versions/{versionId}/publish` | `PublishOperationVersionRequest` (+ Idempotency-Key + If-Match) | `PublishOperationVersionResponse` (versão + operação + auditoria) | `operation.publish` |
| Comparar versões | `VersionCompareDialog` | (client-side) | `GET …/versions/{versionId}/compare/{otherVersionId}` | — | `VersionComparisonResponse` | `operation.view` |
| Pausar / retomar | `pauseOperation` / `resumeOperation` | `OperationsRepository.pause/resume` | `POST …/operations/{operationId}/pause` \| `/resume` | `OperationTransitionRequest` (+ If-Match) | `OperationResponse` | `operation.pause` |
| Arquivar | `archiveOperation` | `OperationsRepository.archive` | `POST …/operations/{operationId}/archive` | `ArchiveOperationRequest` (+ Idempotency-Key + If-Match) | `OperationResponse` | `operation.edit` |
| Duplicar | `duplicateOperation` | `OperationsRepository.duplicate` | `POST …/operations/{operationId}/duplicate` | `DuplicateOperationRequest` (+ Idempotency-Key) | `OperationResponse` | `operation.create` |
| Listar auditoria | `listAuditEvents(ctx, query)` | `AuditRepository.list` | `GET /organizations/{orgId}/audit-events` | `ListAuditEventsQuery` | `AuditEventListResponse` | `audit.view` |
| Detalhe de auditoria | (drawer) | — | `GET …/audit-events/{eventId}` | — | `AuditEventResponse` | `audit.view` |
| Registrar auditoria | `appendAuditEvent` (mock/indexeddb) | `AuditRepository.append` | **sem endpoint** (backend gera transacionalmente) | — | — | — |

## Reconciliações de modelo (contrato v1 vs domínio do frontend)

- **Operation.status**: v1 = `draft|active|paused|archived`. Domínio =
  `draft|awaiting_approval|scheduled|running|paused|archived`. Mapeamento:
  `active → running` (na leitura, `mapOperationToDomain`); `scheduled/running →
  active` (na escrita); `awaiting_approval` pertence à execução (fora do v1).
- **Operação lean vs rica**: o v1 separa a **Operação** (metadados: id, nome, status,
  refs de versão, revisão) da **definição rica** (objetivo, passos, ações, etc.), que
  vive na **versão** (`OperationVersion.definition`). O domínio do frontend achata tudo
  em `Operation`. Campos ricos não cobertos pelo v1 (GAP-12) recebem defaults na
  adaptação de leitura e são **DECISÃO PENDENTE (D-005)**.
- **Gradiente de Autoridade**: hoje autoridade existe por passo/ação
  (`authorityLevel`) e numa matriz de exibição (GAP-11). O v1 introduz um
  `AuthorityProfile` **de nível de versão**. Mapeamento semântico↔numérico em
  `authority.schemas.ts`; direção de `blocked` é **DECISÃO PENDENTE (D-003)**.
- **AuditEvent**: `objectType→resourceType`, `objectId→resourceId`,
  `previousValue→before`, `newValue→after`, `timestamp→occurredAt`; adiciona `actor`
  (objeto), `source`, `correlationId`, `metadata`. Mapper em `repository-compat.ts`.
- **Paginação**: o v1 usa **cursor** (auditoria e listas crescentes). O
  `PaginatedResult` do domínio usa `page/pageSize/total`; a adaptação preenche
  `page/pageSize` e usa o tamanho da página como `total` aproximado (documentado).

## Prova de compatibilidade

`src/services/api/generated/` declara `ArdenApiV1Client` (tipado aos contratos) e
adaptadores que implementam `SessionRepository`, `AuditRepository` (leitura) e
`OperationsRepository` (listagem) — verificados por `client-compat.test.ts`. As
mutações ricas de operação usam o fluxo versão-cêntrico e serão conectadas em marco
posterior (sinalizadas como indisponíveis no v1, sem quebrar tipos).

## Governança e aprovações (ARDEN-BE-004)

- **Políticas** → `docs/api/POLICY_MODEL_ADAPTER_MAP.md`.
- **Aprovações/delegações/enforcement** → `docs/api/APPROVAL_MODEL_ADAPTER_MAP.md`.

Em modo `api` os módulos de Governança e Aprovações consomem os recursos v1 sem fallback
para mock/IndexedDB. A UI usa `POST …/actions/evaluate` apenas como ergonomia; a decisão
final é do servidor.

## Execução (ARDEN-BE-005)

- **Execuções/etapas/eventos** → `docs/api/EXECUTION_MODEL_ADAPTER_MAP.md`.
- **Evidências** → `docs/api/EVIDENCE_MODEL_ADAPTER_MAP.md`.

Em modo `api`, os módulos de Execuções/Evidências consomem os recursos v1 sem fallback e
sem simulação local (sem `setTimeout`/mudança de status local); acompanhamento por polling.

## ARDEN-BE-006 — Connectors and External Tools (contratado)

O cliente v1 (`src/services/api/generated/api-v1-client.ts` +
`src/services/api/v1-http-client.ts`) ganhou os métodos de catálogo, conexões,
credenciais, tool bindings, operation bindings e webhooks — cobertos por
`connector-client-compat.test.ts`. **Nenhuma superfície funcional de frontend é
migrada nesta fase** (006.2 é só contrato). Regras já refletidas nos tipos:

- Requests de credencial carregam `secret` (write-only); as responses trazem **apenas
  metadados** (`CredentialMetadata`: status, `fingerprint`, `keyVersion`, versão, datas).
- `createWebhookEndpoint` retorna `WebhookEndpointSecret` (token + `signingSecret`)
  **uma única vez**; consultas posteriores retornam `WebhookEndpoint` sem segredo.
- Catálogo (`listConnectors/getConnector/listConnectorTools`) é público, sem `organizationId`.
- A futura UI (fase 006.8) NUNCA persistirá segredo em Zustand/IndexedDB, URL, analytics
  ou erro serializado — exibindo apenas `configurada + fingerprint parcial + versão + estado`.

## Integrações / conectores (ARDEN-BE-006)

No modo `api` (`VITE_DATA_PROVIDER=api`), a página de Integrações usa exclusivamente a
API v1 via `ApiV1HttpClient` → repositório `connectors` (`src/services/api/
v1-connectors-repository.ts`) → use-cases (`src/application/connectors/*`) → hooks
(`src/hooks/use-connectors.ts`).

| UI | Cliente gerado | Endpoint |
| --- | --- | --- |
| Catálogo | `listConnectors/getConnector/listConnectorTools` | `GET /connectors[...]` |
| Conexões | `list/create/get/update/testConnection` + `activate/suspend/reactivate/revoke` | `.../connections[...]` |
| Credenciais | `list/create/rotate/revokeCredential` | `.../connections/{id}/credentials[...]` |
| Tool bindings | `list/create/get/update/disableToolBinding` + operation bindings | `.../tool-bindings[...]` |
| Webhooks | `list/create/get/update` + `suspend/reactivate/revoke` | `.../webhook-endpoints[...]` |

Segredos (credencial) e token/segredo one-time de webhook vivem SÓ no estado local do
formulário; nunca em Zustand, React Query, IndexedDB, localStorage, sessionStorage ou
URL. O token do endpoint é exibido uma única vez na criação (`endpointToken`); em replay
idempotente vem `null` (mensagem segura na UI).

## ARDEN-BE-007 — Runtime de agentes

**Nenhuma tela do frontend usa estas APIs ainda.** As telas API-backed de administração
de agentes chegam na fase 007.7. As superfícies "de IA" atuais (`/assessment`,
`/evaluator`, `AssistantPanel`) permanecem mock/determinísticas e NÃO consomem estes
endpoints nesta fase.

| UI (futura) | Cliente (futuro) | Endpoint contratado |
| --- | --- | --- |
| Agentes | `list/create/get/update/suspend/reactivate/revokeAgent` | `.../agents[...]` |
| Versões de agente | `list/create/get/update/publish/retireAgentVersion` | `.../agents/{id}/versions[...]` |
| Providers de modelo | `list/getModelProvider` | `/model-providers[...]` |
| Configurações de modelo | `list/create/get/update/activate/suspend/revokeModelConfiguration` | `.../model-configurations[...]` |

Credencial de provider vive no cofre (BE-006.4), referenciada por conexão; nunca em
resposta, storage do browser, prompt, job, log ou URL. A execução de agente ocorre só via
etapa `agent.execute` do motor de operações — sem endpoint direto de run/chat.

## ARDEN-BE-007.7 — Frontend funcional de agentes (implementado)

No modo `api`, o domínio de agentes usa exclusivamente a API v1 via `ApiV1HttpClient` →
`createApiV1AgentsRepository` (`src/services/api/v1-agents-repository.ts`, API-only) →
use-cases (`src/application/agents/agents.ts`) → hooks (`src/hooks/use-agents.ts`). Tenant
sempre da sessão; custo/avaliação/usage/governança nunca recalculados no cliente. Detalhe
em `docs/frontend/AGENTS_UI_ARCHITECTURE.md` (+ docs irmãs).

| Endpoint v1 | Cliente gerado | Hook | Tela | Permissão |
| --- | --- | --- | --- | --- |
| `GET/POST …/agents`, `…/agents/{id}` (get/update), `…/agents/{id}/suspend\|reactivate\|revoke` | `list/create/get/update/suspend/reactivate/revokeAgent` | `useAgents`/`useAgent` + mutations | `AgentsPage`, `AgentDetailPage` | `agent.view/create/edit/suspend/revoke` |
| `…/agents/{id}/versions[...]` (list/create/get/update/publish/retire) | `list/create/get/update/publish/retireAgentVersion` | `useAgentVersions`/`useAgentVersion` + mutations | `AgentVersionEditorPage` | `agent.view/edit/publish` |
| `GET /model-providers[...]` | `list/getModelProvider` | `useModelProviders` | `ModelConfigurationsPage` | `model_provider.view` |
| `…/model-configurations[...]` (list/create/get/update/activate/suspend/revoke) | `list/create/get/update/activate/suspend/revokeModelConfiguration` | `useModelConfigurations`/`useModelConfiguration` + mutations | `ModelConfigurationsPage` | `model_configuration.view/create/edit/revoke` |
| `GET …/agent-execution-results[...]` (lista + detalhe) | `list/getAgentResult` | `useAgentResults`/`useAgentResult` | `AgentResultsPage` | `agent.view` |
| `GET …/agent-usage` (rollups por `groupBy`) | `getAgentUsage` | `useAgentUsage` | `AgentUsagePage` | `agent.cost.view` |
| `GET …/executions/{runId}/agent-usage` | `getExecutionAgentUsage` | `useExecutionAgentUsage` | detalhe de execução | `agent.view` |

Publicada imutável (sem PATCH; CTA "criar nova versão"); concorrência via `expectedRevision`;
idempotência mintada por ação no repositório. `estimatedCostMinor: null` → "Custo não
disponível", nunca "0,00". Sem segredo/prompt/instrução em storage/URL/log/analytics.

## ARDEN-BE-008.2 — Provider comercial Anthropic (infra administrativa)

**O frontend funcional NÃO foi alterado nesta fase.** Estes dois endpoints são
administrativos/backend-facing (registro/validação da conexão e leitura do catálogo persistido);
o provider permanece `DISABLED` e não há execução. Nenhuma tela consome estas APIs ainda.

| Endpoint v1 (aditivo) | Natureza | Permissão |
| --- | --- | --- |
| `POST …/connections/{id}/validate-configuration` | administrativo — validação **local** (`NOT_VERIFIED_WITH_PROVIDER`, sem segredo na response) | `connection.test` |
| `GET /model-providers/{providerKey}/versions/{providerVersion}/models` | administrativo — catálogo persistido (modelos `DISABLED`, sem preço) | `model_provider.view` |

## ARDEN-BE-008.6 — Frontend administrativo da Anthropic (fatia focada)

<!-- Milestone: ARDEN-BE-008.6 -->

Entregue como **fatia focada**: uma página read-only de administração do provider Anthropic
(`/anthropic`) que consome a API v1 real, **sem mock**. Production: BLOCKED. Live smoke: NOT
EXECUTED. Live tool calling: NOT EXECUTED. Pricing/Data governance: UNVERIFIED.

| UI | Cliente gerado | Hook | Endpoint v1 | Permissão |
| --- | --- | --- | --- | --- |
| `AnthropicAdminPage` (`src/features/anthropic/AnthropicAdminPage.tsx`) — localiza o provider `anthropic.direct` | `list/getModelProvider` | `useModelProviders` | `GET /model-providers` | `model_provider.view` |

As ações da página apenas enlaçam para telas provider-neutras já existentes:
`/integrations?tab=connections` (connection segura + credencial write-only via `SecretField`)
e `/model-configurations` (criação de configuração). Nenhuma tela dedicada de wizard/rotação
foi construída (DEFERIDO).

**Endpoints existentes no OpenAPI, ainda NÃO envelopados pelo cliente gerado do frontend**
(portanto ainda não consumidos por nenhuma tela):

- `GET /model-providers/{providerKey}/versions/{providerVersion}/models` (catálogo por modelo).
- `POST …/connections/{id}/validate-configuration` (validação de configuração).
