# ARDEN-FE-002 — Relatório de Sessão e Tenant

> **Nome do resultado:** ARDEN-FE-002 — Fronteiras de sessão e contexto de tenant.
> Branch `claude/arden-fe-002-session-tenant` · base `faf8d91`. Sem backend, sem
> autenticação real, sem segurança server-side simulada, sem migrar novos agregados.

## Entregue

- **Modelo de identidade** (`src/domain/identity.ts`): `AuthenticatedUser`,
  `OrganizationSummary`, `Membership`, `SessionContext`, `SessionStatus`, helpers
  (`activeMembership`, `activeOrganization`, `deriveSessionStatus`, `isSessionExpired`).
- **Resolvedor de permissões** (`src/domain/permission-resolver.ts`): identificadores
  estáveis; `forRoles/forMembership/can`. Membership suspensa não recebe permissões.
- **Contratos de sessão** (`src/services/session/session-contracts.ts`):
  `SessionRepository`, `OrganizationsRepository`, `MembershipsRepository`,
  `SessionSelectionStore` — específicos, sem repositório genérico único.
- **Providers**:
  - `SnapshotSessionRepository` (mock/indexeddb) deriva a sessão do snapshot e
    persiste só a seleção; `MemorySessionSelectionStore` / `IndexedDbSessionSelectionStore`
    (tabela Dexie nova `sessionState`, **sem tokens**).
  - `MockSessionRepository` com os sete cenários exigidos.
  - `ApiSessionRepository` estrutural; **erro tipado `UNAVAILABLE` sem API configurada,
    sem fallback silencioso**.
- **Contexto de tenant** (`src/app/tenant-context.ts` + `tenant-provider.tsx`): única
  autoridade de sessão; seleção da organização ativa em um só ponto; `can()`;
  `switchOrganization/refreshSession/signOut/switchProfile`.
- **RequestContext** (`src/application/request-context.ts`) derivado da sessão;
  `assertPermission` (defesa local de UX). Propagado a **Operações** e **Auditoria**
  (`listOperations(ctx, …)`, `createOperation(ctx, …)`, `publishOperationVersion(ctx, …)`,
  `appendAuditEvent(ctx, …)` etc.). Tenant do formulário é sobrescrito pelo da sessão.
- **Propagação ao servidor**: `ApiClient` envia `X-Arden-Organization` derivado da
  sessão ativa (`active-context`), nunca de entrada do usuário.
- **Estados de sessão + rotas protegidas**: `SessionBoundary`, `OrganizationBoundary`,
  `PermissionBoundary` com telas distintas; `SessionStateScreen`. `RequirePermission`
  passou a delegar para a `PermissionBoundary`.
- **Troca de organização**: valida membership ativa; limpa cache (`queryClient.clear`);
  reseta estado transitório; mantém a organização anterior em caso de erro; grava
  `organization.switched`.
- **Auditoria local de sessão** (provisória): `session.loaded/refreshed/signed_out`,
  `organization.switched`, `access.denied`. Documentada como não imutável.
- **`use-session.ts` refatorado**: não é mais fonte de verdade autônoma; consome
  `TenantContext` + `PermissionResolver`. A store guarda apenas um espelho
  (`applySession`), escrito só pelo TenantContext; `bootstrap` deixou de criar a sessão.
- **UI**: `OrganizationSwitcher` (lista memberships; suspensas desabilitadas), sign-out
  no menu de perfil, botão de publicar do wizard passa a consultar `operation.publish`.
- **i18n**: chaves `session.*` e `org.*` em pt-BR e en-US.

## Não incluído

Backend; autenticação real (Supabase/Auth0/Clerk/Cognito/login social/MFA/JWT/cookies);
multitenancy real/RLS; autorização server-side; convite por e-mail; recuperação de
senha; administração completa de usuários; migrations; agentes; fila de execução; e a
**migração dos demais agregados de domínio** (aprovações, exceções, arquivos, work
units, orçamento, execuções, implantação, políticas, riscos, integrações, pessoas,
contexto) — continuam usando a store como fonte da verdade.

## Providers validados

| Provider | Como | Resultado |
|---|---|---|
| mock | `MockSessionRepository` (cenários) + `SnapshotSessionRepository` (Memory) | ✅ |
| indexeddb | `SnapshotSessionRepository` + `IndexedDbSessionSelectionStore` (E2E de troca de org) | ✅ |
| api | `ApiSessionRepository` (sem base URL) | ✅ erro tipado `UNAVAILABLE`, sem fallback |

## Fluxos de troca de organização validados

- Troca válida (Grupo Atlas ↔ Horizonte Holdings) com limpeza de cache e isolamento
  de dados (E2E Fluxo 1).
- Troca para organização sem membership → `FORBIDDEN` (unit).
- Falha na troca mantém a organização anterior (unit render).

## Riscos remanescentes

- **Nada aqui é segurança de produção**; todo `can()`/boundary é burlável no cliente.
- Auditoria de sessão local e mutável (best-effort), não imutável.
- Fatias de domínio não migradas herdam o `organizationId` do espelho de sessão.
- Em modo `api` sem backend, a sessão falha com erro tipado (esperado).
- Identidade de usuário derivada por e-mail no snapshot (simulação).

## Observação sobre nomenclatura de permissões

Os identificadores de permissão já são **estáveis e com namespace por domínio**
(`operation.view`, `operation.publish`, `approval.resolve`, `audit.view`, …). Os
exemplos do enunciado (`operations.read`, …) são ilustrativos; manter os identificadores
existentes evita uma renomeação de alto risco em toda a base. Componentes consultam
**permissões** (`can("operation.publish")`), não nomes de papel.
