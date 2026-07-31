# Arden.AS — Modelo de Autorização (ARDEN-BE-002)

> Autorização é **server-side** e **deny-by-default**. O frontend nunca envia papéis
> ou permissões — esconder um botão é UX, não segurança.

## Permissões efetivas

`AuthorizationService` (`src/authz/authorization.service.ts`) computa as permissões
efetivas a partir **exclusivamente** do estado do servidor:

```
permissões efetivas =
    usuário ACTIVE
  ∧ organização ACTIVE
  ∧ membership ACTIVE (não REVOKED/SUSPENDED)
  ∧ ⋃ permissões dos papéis ACTIVE atribuídos à membership
```

Se **qualquer** condição falhar → conjunto **vazio** (negar). Papéis `INACTIVE` são
ignorados. O resultado nunca depende de dado enviado pelo cliente.

## Decisão de acesso a organização

`authorizeOrganizationAccess(userId, orgId)` retorna um resultado **ordenado** para
combinar erros específicos com proteção contra enumeração:

| Situação | `kind` | Resposta |
| --- | --- | --- |
| Organização inexistente | `org_not_found` | **404** (não revela existência) |
| Usuário não `ACTIVE` | `user_suspended` | **403** `FORBIDDEN` |
| Sem membership | `no_membership` | **404** (anti-enumeração) |
| Organização suspensa | `org_suspended` | **403** `ORGANIZATION_SUSPENDED` |
| Membership suspensa | `membership_suspended` | **403** `MEMBERSHIP_SUSPENDED` |
| OK | `ok` | permissões efetivas no contexto |

A ordem garante que “existe mas você não é membro” e “não existe” devolvam **o mesmo
404** — um estranho não consegue enumerar organizações.

## Guards e decorators

Cadeia global (`src/authz/authz.module.ts`), em ordem:

1. `AuthenticationGuard` — Bearer → `verifyAccessToken` → provisiona → contexto.
2. `ActiveUserGuard` — bloqueia usuário não `ACTIVE`.
3. `OrganizationGuard` — dispara em `:organizationId` no path **ou** `@RequireOrganization`;
   valida acesso e popula permissões no contexto.
4. `PermissionGuard` — exige as permissões de `@RequirePermission` contra o contexto.

Decorators (`src/authz/decorators.ts`):

- `@Public()` — ignora autenticação (rotas técnicas).
- `@RequireOrganization()` — exige organização ativa mesmo sem `:organizationId` no path.
- `@RequirePermission('organization.view')` — exige permissão específica.

Exemplo (`organizations.controller.ts`):

```ts
@Get(':organizationId')
@RequireOrganization()
@RequirePermission('organization.view')
getOne(@Param('organizationId') id: string) { ... }
```

## O path localiza o tenant, não autoriza

O `organizationId` do path **apenas identifica** o tenant. A **autorização** é sempre a
membership validada server-side, recalculada **a cada requisição**. Não há “tenant livre
no corpo” nem confiança no path. Ver `MULTITENANCY_ENFORCEMENT.md`.

## Fonte das permissões

O catálogo (`ALL_PERMISSIONS`) e o mapa papel→permissões (`ROLE_PERMISSIONS`) vêm da
fonte única do frontend e são semeados no banco. Um teste garante que o catálogo semeado
cobre exatamente `ALL_PERMISSIONS`. Nenhuma permissão é inventada em runtime.

## Negações são auditadas

Toda negação relevante (`access.denied`, `organization.access_denied`,
`membership.access_denied`, `permission.access_denied`,
`organization.selection_denied`) é registrada em `IdentityAuditEvent` com `reasonCode`.
