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
