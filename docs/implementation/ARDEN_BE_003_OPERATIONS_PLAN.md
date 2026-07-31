# ARDEN-BE-003 — Plano: Operações, Versões, Autoridade, Publicação e Auditoria

> Plano de execução da primeira funcionalidade **de negócio** do backend: operações,
> versões, gradiente de autoridade (GAP-11), publicação transacional e auditoria de
> operações. Base: `claude/arden-be-002-identity-tenancy`. Contrato: OpenAPI v1 aprovada
> (`docs/api/openapi-v1.yaml`), **inalterada**.

## Objetivo funcional

Um usuário autorizado, no contexto de uma organização, cria uma operação (que já nasce
com a 1ª versão em rascunho e defaults neutros), edita o rascunho da versão, define o
gradiente de autoridade, **publica** a versão (transação atômica com validação, supersede
e auditoria) e consulta a **auditoria** — tudo isolado por tenant, com idempotência e
concorrência otimista.

## Decisões-chave

1. **Modelo lean + versão-cêntrico (GAP-12)**: a operação carrega metadados e ponteiros;
   o conteúdo rico vive em `OperationVersion.definition`. Campos ricos não cobertos pelo
   v1 são adiados (D-005) com defaults neutros documentados — **nada inventado**. Ver
   `docs/api/OPERATION_MODEL_ADAPTER_MAP.md`.
2. **Autoridade de nível de versão (GAP-11)**: `AuthorityProfile` por versão é a
   **classificação primária de publicação**; validação pura (níveis 1–5), sem motor de
   execução. Ver `docs/domain/AUTHORITY_PROFILE_MODEL_V1.md`.
3. **Publicação em uma única transação**: validar → promover rascunho → supersede →
   atualizar operação → auditar → idempotência. Qualquer falha reverte tudo (teste de
   rollback obrigatório). Ver `docs/backend/OPERATION_PUBLICATION_TRANSACTION.md`.
4. **Imutabilidade no service**: versões `published`/`superseded` são imutáveis
   (`409 ALREADY_PUBLISHED`) — imposto no service, não só no controller.
5. **Multitenancy rígido**: toda query inclui `organizationId`; nunca `findUnique` por
   `id`; cross-tenant → 404 (anti-enumeração). Path localiza, membership autoriza.
6. **Idempotência**: `Idempotency-Key` obrigatório em create/duplicate/archive/
   version-create/publish; check primeiro (replay curto-circuita); registro dentro da
   transação. Pause/resume são idempotentes por estado.
7. **Concorrência otimista**: `expectedRevision`/`If-Match` + guarda
   `updateMany WHERE revision = expected`; conflito → `409 VERSION_CONFLICT`.
8. **Auditoria dedicada (nova tabela)**: `audit_events` serve o contrato HTTP
   (`actor`/`source`/`before`/`after`); append-only; separada do `IdentityAuditEvent` de
   BE-002 (que não é alterado).
9. **Reuso do contrato e dos guards**: DTOs validados contra `@arden/contracts`; guards e
   contexto de BE-002; OpenAPI inalterada.

## Etapas

| # | Etapa | Entregáveis |
| --- | --- | --- |
| 1 | Modelo de dados + migração | enums (`OperationStatus`, `OperationVersionStatus`, `AuditSource`), `Operation`, `OperationVersion`, `AuditEvent`; migração `20260731193511_operations_versions_audit` |
| 2 | Repositórios tenant-scoped | `OperationsRepository`, `OperationVersionsRepository`, `AuditRecorder`, `AuditService` (aceitam tx) |
| 3 | Serializers + defaults neutros | validação zod de saída; `NEUTRAL_DEFINITION`, `NEUTRAL_AUTHORITY_PROFILE` |
| 4 | Services + regras | criação transacional, edição/imutabilidade, `authority.rules.ts`, `publication.validator.ts` |
| 5 | Idempotência + concorrência | `command.helpers.ts`; extensão de `IdempotencyService.check/remember` (tx opcional) |
| 6 | Controllers finos | rotas org-escopadas; `@RequireOrganization`/`@RequirePermission`; headers |
| 7 | Auditoria | catálogo de eventos; saneamento; leitura por cursor + filtros |
| 8 | Testes | unit (55) + integração Postgres real (81), incluindo rollback e A/B/C |
| 9 | Docs | 7 backend + 1 domínio + 1 api + 3 implementação |

## Permissões (do contrato)

`view→operation.view`; `create/duplicate→operation.create`;
`update/archive/version-create/version-update/authority-update→operation.edit`;
`pause/resume→operation.pause`; `publish→operation.publish`; `audit→audit.view`.
Não existe `operation.archive` — arquivar usa `operation.edit`.

## Gates (a rodar, não neste doc)

`test:api`, `test:api:integration`, `typecheck:api`, `lint:api`, `build:api`,
`db:migrate:status`, `contracts:openapi` em sincronia.

## Fora de escopo

Motor de execução, agentes, execução de operações. Definição rica completa do wizard
(D-005). Consolidação da auditoria de identidade e de operações (futura).
