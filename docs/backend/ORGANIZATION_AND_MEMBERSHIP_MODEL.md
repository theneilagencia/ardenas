# Arden.AS — Modelo de Organização e Membership (ARDEN-BE-002)

> O modelo de dados da identidade e do tenant. Definido em
> `apps/api/prisma/schema.prisma`, migração `20260731120709_identity_tenancy`
> (+ `20260731142624_system_role_unique`).

## Entidades

### `User` (`users`)
Usuário interno do Arden, provisionado por identidade externa.

- Identidade externa **única**: `@@unique([externalProvider, externalSubject])`
  (`uniq_external_identity`). O `externalSubject` é imutável.
- `status`: `ACTIVE` | `SUSPENDED` | `DEACTIVATED`. Só `ACTIVE` acessa.
- `email`/`displayName` são atualizáveis (não são identidade).
- `lastAuthenticatedAt` registrado a cada login.

### `Organization` (`organizations`)
Tenant. `slug` **único**. `status`: `ACTIVE` | `SUSPENDED` | `ARCHIVED`. `revision`
para concorrência otimista.

### `Membership` (`memberships`)
Relação usuário↔organização. **Única** por `@@unique([userId, organizationId])`
(`uniq_membership`). `status`: `ACTIVE` | `INVITED` | `SUSPENDED` | `REVOKED`.
Memberships `REVOKED` **nunca** aparecem na sessão.

### `Role` (`roles`) e `Permission` (`permissions`)
- `Permission.key` **único** — catálogo estável.
- `Role` pode ser de **sistema** (`organizationId = null`, `system = true`) ou de
  organização. Unicidade por `@@unique([organizationId, key])` **mais** um índice
  **parcial** `uniq_system_role_key` sobre `key WHERE organization_id IS NULL`
  (NULL é distinto de NULL em índices compostos SQL — sem o parcial, papéis de
  sistema duplicados seriam possíveis).
- `Role.status`: `ACTIVE` | `INACTIVE`. Papel `INACTIVE` **não** concede permissões.

### Junções
- `RolePermission` (`@@id([roleId, permissionId])`) — permissões de um papel.
- `MembershipRole` (`@@id([membershipId, roleId])`) — papéis de uma membership.

### `UserSessionPreference` (`user_session_preferences`)
Organização ativa preferida por usuário (`userId @id`). Validada server-side a cada uso.

### `IdentityAuditEvent` (`identity_audit_events`)
Append-only. Ver `IDENTITY_AUDIT_EVENTS.md`.

## Catálogo de permissões (fonte única)

O catálogo de permissões e o mapa papel→permissões vêm da **fonte única do frontend**
(`src/domain/permissions`, ARDEN-FE-002): `ALL_PERMISSIONS` e `ROLE_PERMISSIONS`. O seed
(`prisma/seed.ts`) importa esse catálogo — **sem duplicar** — e é idempotente (upsert +
convergência de grants obsoletos). São 8 papéis de sistema (`corporate_admin`,
`financial_admin`, `operation_owner`, `supervisor`, `approver`, `security_admin`,
`analyst`, `auditor`).

> A relação de contratos/domínio é importada apenas em tempo de seed/teste; o diretório
> `prisma/` fica fora do `rootDir` do build da API, então não acopla o runtime.

## Invariantes garantidas por banco

- Uma identidade externa → no máximo um usuário.
- Um par (usuário, organização) → no máximo uma membership.
- Uma chave de permissão → uma permissão.
- Uma chave de papel de sistema → um papel de sistema.

Essas invariantes são cobertas por testes de integração
(`test/bootstrap-constraints.integration.spec.ts`).
