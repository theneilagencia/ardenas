# ARDEN-FE-002 — Plano de Sessão e Tenant

> **Nome do resultado:** ARDEN-FE-002 — Fronteiras de sessão e contexto de tenant.
> Base: `claude/arden-fe-002-session-tenant` (a partir de `faf8d91`). Sem backend,
> sem autenticação real, sem segurança server-side simulada, sem migrar novos
> agregados de domínio.

## Objetivo

Preparar o frontend para receber autenticação real, organizações reais, memberships,
papéis e contexto de tenant, com **contratos explícitos** e uma arquitetura que **não
confunde simulação com segurança**. Ver `docs/architecture/SESSION_AND_TENANCY_BOUNDARIES.md`.

## Princípio aplicado

O frontend decide o que exibir; **nunca** é autoridade final sobre identidade, papel,
tenant ou permissão. `can()`/boundaries são **controle de experiência**; o backend
revalidará cada ação.

## Modelo de identidade (domínio)

- `AuthenticatedUser`, `OrganizationSummary`, `Membership`, `SessionContext`,
  `SessionStatus` em `src/domain/identity.ts`.
- Um "usuário" é identificado por e-mail; cada registro de pessoa por organização vira
  uma `Membership`. Não duplica os tipos de domínio existentes (`Person`, `Organization`,
  `Role`).

## Contratos

- `SessionRepository` (`getCurrentSession/switchOrganization/refreshSession/signOut`).
- Contratos específicos auxiliares: `OrganizationsRepository`, `MembershipsRepository`,
  `SessionSelectionStore` (sem repositório genérico único).
- `PermissionResolver` (identificadores estáveis, já com namespace por domínio).
- `RequestContext` (`userId/organizationId/correlationId/actorRole/permissions`),
  derivado da sessão; `assertPermission` para defesa local de UX.

## Providers (compatíveis com ARDEN-FE-001)

- **mock/indexeddb:** `SnapshotSessionRepository` deriva a sessão do snapshot e
  persiste apenas a seleção (usuário/organização ativos) — via `MemorySessionSelectionStore`
  ou `IndexedDbSessionSelectionStore`. **Não guarda tokens.**
- **api:** `ApiSessionRepository` estruturalmente pronto; **sem API configurada, erro
  tipado `UNAVAILABLE`** — sem fallback silencioso para mock.
- **Cenários de mock** (testes): uma org, várias orgs, sem org, usuário suspenso,
  membership suspensa, sessão expirada, permissão insuficiente.

## Contexto de tenant

- `TenantContext`/`TenantProvider`: única autoridade de sessão no cliente. Seleção da
  organização ativa em um só ponto; espelho mínimo na store (`applySession`);
  propagação do tenant ao `ApiClient` (`active-context`); limpeza de cache na troca/saída.

## Estados de sessão e rotas protegidas

- `SessionBoundary`, `OrganizationBoundary`, `PermissionBoundary` com telas distintas
  por estado. Nada é redirecionado silenciosamente ao Dashboard.

## Propagação do contexto

- Casos de uso de Operações e Auditoria passam a receber o `RequestContext` de forma
  consistente (`listOperations(ctx, query)`, `createOperation(ctx, input)`,
  `appendAuditEvent(ctx, input)`), sem alterar o comportamento funcional. O
  `organizationId` vem da sessão; input de formulário é sobrescrito.

## Migração do `use-session.ts`

- Deixa de ser fonte de verdade autônoma; consome `TenantContext` + `PermissionResolver`
  (e, por baixo, o `SessionRepository`). A store guarda apenas um **espelho** escrito
  pelo TenantContext.

## Fora de escopo (não implementar)

Supabase/Auth0/Clerk/Cognito, login social, MFA, JWT/cookies reais, backend, banco
remoto, RLS, convite por e-mail, recuperação de senha, autorização server-side,
administração completa de usuários, migrations, agentes, fila de execução, e a
migração dos demais agregados de domínio.
