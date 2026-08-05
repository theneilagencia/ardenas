# Arden.AS — Arquitetura do Módulo de Operações (ARDEN-BE-003)

> Primeira funcionalidade **de negócio** do backend: operações, versões, gradiente de
> autoridade, publicação transacional e auditoria de operações. O backend é a
> **autoridade** — o frontend nunca decide tenant, permissão, estado de versão ou
> resultado de publicação. Base: `claude/arden-be-002-identity-tenancy`.

## Princípio central

A **operação** é um agregado *lean* (metadados + ponteiros de versão); todo o conteúdo
rico de negócio vive em uma **versão** (`OperationVersion.definition`). O ciclo de vida
(rascunho → publicado → substituído), o gradiente de autoridade e a auditoria são
computados e aplicados **no servidor**, dentro de transações. O path localiza o tenant;
os guards de BE-002 autorizam.

```
Cliente ──Bearer──▶ [Guards BE-002] ──▶ OperationsController / VersionsController / AuditController
                        │                          │
   RequireOrganization  │                          ▼
   RequirePermission    │              OperationsService / OperationVersionsService
                        │                          │  (regras, validação, transação)
                        ▼                          ▼
              @CurrentContext          Repositories (tenant-scoped, aceitam tx)
              (ctx validado)           AuditRecorder (append dentro da tx)
                                                   │
                                                   ▼
                                       Serializers → DTOs @arden/contracts (zod)
```

## Camadas

| Camada | Arquivos | Responsabilidade |
| --- | --- | --- |
| Controllers (finos) | `src/operations/operations.controller.ts`, `operation-versions.controller.ts`, `src/audit/audit.controller.ts` | Traduzir HTTP↔serviço; declarar `@RequireOrganization`/`@RequirePermission`; extrair `@CurrentContext`, headers (`Idempotency-Key`, `If-Match`). Nenhuma regra de negócio. |
| Services | `src/operations/operations.service.ts`, `operation-versions.service.ts`, `src/audit/audit.service.ts` | Regras, imutabilidade, orquestração transacional, idempotência, concorrência otimista. |
| Validador de publicação | `src/operations/publication.validator.ts` | `OperationPublicationValidator.validate(operation, version, ctx)` → `{valid, errors[], warnings[]}`. Roda **antes** da transação. |
| Regras de autoridade | `src/operations/authority.rules.ts` | Validação **pura** do `AuthorityProfile` (níveis 1–5, ações destrutivas). Sem I/O. |
| Repositories | `src/operations/operations.repository.ts`, `operation-versions.repository.ts`, `src/audit/audit-recorder.ts` | Acesso a dados **tenant-scoped**; aceitam um cliente de transação. |
| Serializers | `src/operations/operations.serializer.ts`, `operation-versions.serializer.ts`, `src/audit/audit.serializer.ts` | Montar e **validar** DTOs de saída contra os schemas zod de `@arden/contracts`. |
| Helpers de comando | `src/operations/command.helpers.ts` | Idempotência, hashing de corpo, envelopes de comando transacional. |

## Rotas (org-escopadas)

Todas sob `organizations/:organizationId/operations…`. Batem **exatamente** com a OpenAPI
v1 aprovada (`docs/api/openapi-v1.yaml` — inalterada, ainda em sincronia).

| Método | Rota | Permissão |
| --- | --- | --- |
| `GET` | `/operations` | `operation.view` |
| `POST` | `/operations` | `operation.create` |
| `GET` | `/operations/{id}` | `operation.view` |
| `PATCH` | `/operations/{id}` | `operation.edit` |
| `POST` | `/operations/{id}/pause` \| `/resume` | `operation.pause` |
| `POST` | `/operations/{id}/archive` | `operation.edit` |
| `POST` | `/operations/{id}/duplicate` | `operation.create` |
| `GET` \| `POST` | `/operations/{id}/versions` | `operation.view` \| `operation.edit` |
| `GET` \| `PATCH` | `/operations/{id}/versions/{versionId}` | `operation.view` \| `operation.edit` |
| `POST` | `/operations/{id}/versions/{versionId}/publish` | `operation.publish` |
| `GET` | `/operations/{id}/versions/{versionId}/compare/{otherVersionId}` | `operation.view` |
| `GET` \| `PATCH` | `/operations/{id}/versions/{versionId}/authority` | `operation.view` \| `operation.edit` |
| `GET` | `/audit-events` \| `/audit-events/{eventId}` | `audit.view` |

> **Nota sobre `archive`**: não existe permissão `operation.archive`. Arquivar exige
> `operation.edit`, conforme a matriz de autorização do contrato.

## Fluxo de requisição (exemplo: criar operação)

1. Guards de BE-002 autenticam, validam usuário/organização/membership e exigem
   `operation.create`.
2. O controller extrai `@CurrentContext` (contém `organizationId` **validado**) e o
   header obrigatório `Idempotency-Key`.
3. O service checa idempotência **primeiro** (replay curto-circuita); para requisição
   nova, executa **uma transação** que cria a operação (`draft`, revision 1), a primeira
   versão (`versionNumber 1`, definição/autoridade neutras), aponta
   `currentDraftVersionId`, grava a auditoria (`operation.created`,
   `operation_version.created`) e o registro de idempotência.
4. O serializer valida o `OperationResponse` contra o schema zod antes de responder 201.

## Relação com BE-002

- **Reuso total** dos guards e do contexto: `RequireOrganization` (path localiza o
  tenant), `RequirePermission` (autorização server-side), `@CurrentContext` (contexto
  validado). Ver `IDENTITY_ARCHITECTURE.md` e `MULTITENANCY_ENFORCEMENT.md`.
- **Auditoria separada**: BE-003 introduz `AuditEvent` (tabela `audit_events`) dedicada
  à auditoria de operações e ao contrato HTTP (`actor`/`source`/`before`/`after`). O
  `IdentityAuditEvent` de BE-002 permanece um fluxo **interno** de identidade. A
  consolidação futura é possível, mas BE-002 é um PR separado que **não** deve ser
  alterado, e a forma da auditoria HTTP difere. Ver `OPERATION_AUDIT_EVENTS.md`.

## O que NÃO está aqui

- Não há **motor de execução**. O gradiente de autoridade é **classificação de
  publicação**, não runtime (ver `AUTHORITY_PROFILE_MODEL_V1.md`).
- Operações **não são executadas**; nenhum agente é implementado.
- A definição rica completa do wizard é adiada (D-005 / GAP-12); ver
  `OPERATION_MODEL_ADAPTER_MAP.md`.

Ver também: `OPERATION_VERSIONING.md`, `OPERATION_PUBLICATION_TRANSACTION.md`,
`OPERATION_MULTITENANCY.md`, `OPERATION_IDEMPOTENCY.md`, `OPERATION_CONCURRENCY.md`.
