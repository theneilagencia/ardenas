# ARDEN-BE-003 — Relatório de Implementação: Operações, Versões, Autoridade e Auditoria

> O que foi entregue, onde, e como **cada condição de FALHA** da issue foi evitada.
> Branch: `claude/arden-be-003-operations-versions`.

## Entregue

- **Modelo de dados** (`apps/api/prisma/schema.prisma`, migração
  `20260731193511_operations_versions_audit`): enums `OperationStatus`
  (`draft/active/paused/archived`), `OperationVersionStatus`
  (`draft/published/superseded`), `AuditSource` (`user/system/integration`); modelos
  `Operation` (`operations`), `OperationVersion` (`operation_versions`), `AuditEvent`
  (`audit_events`). Reusa `AuditOutcome` (`SUCCESS/DENIED/FAILURE`).
- **Módulo de operações** (`apps/api/src/operations/*`): controllers finos,
  `OperationsService`, `OperationVersionsService`, `OperationsRepository`,
  `OperationVersionsRepository`, serializers (validação zod), `authority.rules.ts`
  (regras puras), `publication.validator.ts`, `command.helpers.ts` (idempotência).
- **Módulo de auditoria** (`apps/api/src/audit/*`): `AuditRecorder` (append na tx),
  `AuditService` (leitura por cursor + filtros), controller read-only.
- **Idempotência estendida** (`apps/api/src/modules/idempotency/idempotency.service.ts`):
  `check/remember` aceitam cliente de transação (retrocompatível).
- **Contrato**: DTOs validados contra `@arden/contracts`; endpoints batem com a OpenAPI
  v1 aprovada (`docs/api/openapi-v1.yaml` — inalterada, em sincronia).
- **Fábricas de erro**: `ApiException.alreadyPublished`, `invalidStateTransition`,
  `resourceConflict` (códigos já existiam no catálogo).

## Como cada condição de FALHA foi evitada

| Condição de FALHA | Como foi evitada |
| --- | --- |
| Operação sem `organizationId` | `organizationId` obrigatório no modelo; vem do contexto validado (path), nunca do body. |
| Versão sem tenant | `OperationVersion.organizationId` obrigatório; toda escrita/leitura escopada. |
| Query só por `id` | Sempre `findFirst({ where: { id, organizationId } })`; nunca `findUnique` por `id`. |
| Frontend enviando permissões | Permissões computadas server-side (guards BE-002); nunca do cliente. |
| Frontend mudando tenant no body | Tenant vem só do path/contexto; body não define `organizationId`. |
| Mutar versão publicada | Imutabilidade no **service**: `published/superseded` → `409 ALREADY_PUBLISHED`. |
| Publicação em múltiplas transações | Publicação é **uma** transação (validar/promover/supersede/atualizar/auditar/idempotência). |
| Rollback parcial | Falha reverte o comando inteiro — comprovado por **teste de rollback obrigatório**. |
| Idempotência duplicada | `Idempotency-Key` obrigatório; mesmo corpo → replay; corpo diferente → `409 IDEMPOTENCY_CONFLICT`; registro na tx. |
| Sobrescrita por concorrência | `expectedRevision`/`If-Match` + guarda `updateMany WHERE revision=expected`; segundo escritor → `409 VERSION_CONFLICT`. |
| Auditoria com update/delete | `AuditEvent` é **append-only**; sem update/delete/POST público; gravada na tx. |
| Gradiente decorativo | `AuthorityProfile` de nível de versão valida a publicação (`authority.rules.ts`, níveis 1–5); erros bloqueiam. |
| Adaptador inventando dados | Apenas **defaults neutros** documentados; nada substantivo inventado (D-005). |
| Api caindo para mock | Modo api não faz fallback para mock (herdado de BE-002; E2E em esforço paralelo). |
| Operações executadas | **Não há** motor de execução; gradiente é classificação de publicação, não runtime. |
| Agentes implementados | **Nenhum** agente implementado. |

## Notas de projeto

- **Auditoria dedicada**: `audit_events` é uma tabela **nova** para a auditoria de
  operações e o contrato HTTP (`actor`/`source`/`before`/`after`). O `IdentityAuditEvent`
  de BE-002 permanece separado e **não** foi alterado (PR distinto). Consolidação futura
  possível. Ver `docs/backend/OPERATION_AUDIT_EVENTS.md`.
- **Ponteiros sem FK**: `currentDraftVersionId`/`publishedVersionId` são ponteiros sem FK
  (geridos transacionalmente; sem delete físico de versão), evitando ciclo e cascata
  destrutiva.
- **Owner**: se `ownerId` é informado na criação, precisa ser membro **ativo** do tenant,
  senão `422`.
- **`operation.archive` inexistente**: arquivar usa `operation.edit`.
- **Frontend/E2E**: integração em modo api e E2E de operações são conectados em esforço
  paralelo.

## Referência

- Backend: `OPERATIONS_ARCHITECTURE.md`, `OPERATION_VERSIONING.md`,
  `OPERATION_PUBLICATION_TRANSACTION.md`, `OPERATION_MULTITENANCY.md`,
  `OPERATION_AUDIT_EVENTS.md`, `OPERATION_IDEMPOTENCY.md`, `OPERATION_CONCURRENCY.md`.
- Domínio/API: `AUTHORITY_PROFILE_MODEL_V1.md`, `OPERATION_MODEL_ADAPTER_MAP.md`.
- Decisões: `docs/api/API_V1_OPEN_DECISIONS.md` (D-002 a D-006).
- Evidência: `ARDEN_BE_003_TEST_EVIDENCE.md`.
