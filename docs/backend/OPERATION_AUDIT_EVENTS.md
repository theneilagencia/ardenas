# Arden.AS — Auditoria de Operações (ARDEN-BE-003)

> Registro **append-only** de eventos de operação/versão/autoridade, servindo o contrato
> HTTP (`actor`/`source`/`before`/`after`). Sem update, sem delete, sem POST público —
> o backend gera os eventos **dentro** das transações de comando. Nunca contém segredos.

## Modelo

`AuditEvent` (`audit_events`) — tabela **nova**, dedicada às operações e à forma do
contrato HTTP:

| Campo | Descrição |
| --- | --- |
| `id` | UUID. |
| `organizationId` | Tenant (toda query escopada por ele). |
| `actorUserId` | Usuário ator (quando conhecido). |
| `actorType` | `AuditSource` = `user` \| `system` \| `integration` (default `user`). |
| `actorRole` / `actorDisplayName` | Papel e nome de exibição do ator (denormalizados). |
| `action` | Ação (ver catálogo). |
| `resourceType` / `resourceId` | Recurso afetado (ex.: `operation`, `operation_version`). |
| `outcome` | `AuditOutcome` = `SUCCESS` \| `DENIED` \| `FAILURE` (default `SUCCESS`). **Interno** — não exposto no contrato HTTP. |
| `correlationId` | Correlação fim-a-fim com a requisição. |
| `before` / `after` | `Json?` — estado de negócio antes/depois (o propósito da auditoria). |
| `metadata` | `Json` (default `{}`) — **saneado**. |
| `occurredAt` | Timestamp UTC. |

Índices: `[organizationId, occurredAt]`, `[organizationId, resourceType, resourceId]`,
`[correlationId]`.

> **Enums em minúsculas** (`AuditSource`) casam com o contrato HTTP. `AuditOutcome`
> reusa o enum de BE-002 (`SUCCESS`/`DENIED`/`FAILURE`) e permanece **interno**.

## Relação com a auditoria de identidade (BE-002)

Esta é uma tabela **separada** do `IdentityAuditEvent` de BE-002, que continua sendo o
fluxo **interno** de identidade. Decisão documentada: a forma da auditoria HTTP difere
(`actor`/`source`/`before`/`after`) e BE-002 é um PR separado que **não** deve ser
alterado. Uma consolidação futura é possível. Ver `IDENTITY_AUDIT_EVENTS.md`.

## Append-only

`AuditRecorder` (`src/audit/audit-recorder.ts`) apenas **cria** eventos, e o faz **dentro
da transação** do comando — de modo que um rollback (ver
`OPERATION_PUBLICATION_TRANSACTION.md`) não deixa evento de sucesso. Não existe caminho
de update, delete ou POST público de auditoria.

## Catálogo de ações

| Ação | Quando |
| --- | --- |
| `operation.created` | Operação criada (com a 1ª versão). |
| `operation.updated` | Metadados atualizados / operação alterada na publicação. |
| `operation.paused` | Operação pausada. |
| `operation.resumed` | Operação retomada. |
| `operation.archived` | Operação arquivada. |
| `operation.duplicated` | Operação duplicada. |
| `operation_version.created` | Versão criada (1ª ou a-partir-da-base). |
| `operation_version.updated` | Rascunho de versão atualizado. |
| `operation_version.publication_validated` | Validação de publicação aprovada (na transação). |
| `operation_version.published` | Versão promovida a `published`. |
| `operation_version.publication_failed` | Validação de publicação falhou (`FAILURE`, best-effort). |
| `operation_version.superseded` | Versão publicada anterior rebaixada. |
| `authority_profile.updated` | `AuthorityProfile` da versão atualizado. |

`before`/`after` carregam os **snapshots de negócio** (operação/versão) — a razão de ser
da auditoria.

## Saneamento de metadados

Antes de gravar, `metadata` passa por redação: qualquer chave que combine
`/(authorization|token|secret|password|cookie)/i` vira `[REDACTED]`. Segredos e tokens
nunca entram no log.

## Leitura: paginação por cursor + filtros

`GET /audit-events` (`AuditService`, permissão `audit.view`) é **read-only** e paginado
por **cursor determinístico**:

- ordenação `occurredAt DESC, id DESC` (desempate estável);
- cursor `base64url` de `occurredAt|id`;
- filtros: `actorId`, `action`, `resourceType`, `resourceId`, `correlationId`, `from`,
  `to`.

`GET /audit-events/{eventId}` retorna um único evento (tenant-scoped; cross-tenant → 404).

Coberto por unit (serialização/cursor) e integração (fluxo/filtros/isolamento). Ver
`OPERATION_MULTITENANCY.md` e `ARDEN_BE_003_TEST_EVIDENCE.md`.
