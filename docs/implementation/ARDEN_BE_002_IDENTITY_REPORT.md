# ARDEN-BE-002 — Relatório de Implementação: Identidade e Tenancy

> O que foi entregue, onde, e como cada requisito de segurança foi satisfeito.

## Entregue

- **Modelo de dados** (`prisma/schema.prisma`): `User`, `Organization`, `Membership`,
  `Role`, `Permission`, `RolePermission`, `MembershipRole`, `UserSessionPreference`,
  `IdentityAuditEvent`, com enums de status. Migrações `20260731120709_identity_tenancy`
  e `20260731142624_system_role_unique` (índice parcial de papel de sistema).
- **Autenticação** (`src/identity/`): adaptador `IdentityProvider`,
  `SupabaseIdentityProvider` (JWKS/jose), `FakeIdentityProvider` (dev/testes, bloqueado
  em production), módulo global com seleção única por config.
- **Provisionamento JIT** (`user-provisioning.service.ts`) por `(provider, subject)`.
- **Autorização** (`src/authz/`): `AuthorizationService` (permissões efetivas server-side),
  decorators `@Public`/`@RequireOrganization`/`@RequirePermission`, cadeia de 4 guards
  globais.
- **Sessão** (`src/session/`): `GET /session`, `POST /session/refresh`,
  `POST /session/switch-organization`, `POST /session/logout`, validados contra o
  contrato `@arden/contracts`. Rate limit próprio.
- **Organizações** (`src/organizations/`): `GET /organizations`,
  `GET /organizations/{id}`, `GET /organizations/{id}/memberships/me`.
- **Seed** (`prisma/seed.ts`) idempotente do catálogo, importando a fonte única do
  frontend. **Bootstrap** (`prisma/bootstrap-organization.ts`) seguro por CLI.
- **Auditoria** append-only com redação de sensíveis.
- **Integração frontend↔backend** (modo api): portador de access token
  (`src/services/session/access-token.ts`) e E2E de sessão/organizações.

## Como cada condição de FALHA foi evitada

| Condição de FALHA | Como foi evitada |
| --- | --- |
| Senha armazenada | Nunca; identidade/token são do provedor. |
| E-mail como identidade estável | Identidade é `(provider, subject)`; e-mail é atualizável. |
| Papel/permissão vindos do frontend | Computados no servidor a partir do banco. |
| Tenant livre no corpo | Organização vem da sessão/preferência validada; corpo não define tenant. |
| `organizationId` do path como autorização | Path só localiza; membership server-side autoriza. |
| Auto-admin | Nenhuma concessão automática; admin só via bootstrap CLI. |
| `service_role` exposto | Verificação usa apenas JWKS público. |
| JWT só decodificado | Assinatura JWKS verificada; sem verificação, rejeitado. |
| Algoritmo não restrito | Apenas `RS256`/`ES256`; `HS256` rejeitado. |
| Auth fake em production | Config proíbe `AUTH_PROVIDER=fake` em production. |
| Fallback silencioso | Seleção de provedor única; modo api sem base/token erra explicitamente. |
| Usuário/membership suspensos acessando | Guards bloqueiam; permissões efetivas vazias. |
| Negações não auditadas | Toda negação registra evento `DENIED` com `reasonCode`. |
| Testes só com DB mockado | Integração usa Postgres real. |
| Multitenancy não testado | Cenário crítico A/B/C testado por HTTP real. |
| Contratos duplicados | Reuso de `@arden/contracts` e do catálogo do frontend. |
| Operações implementadas | Fora de escopo; apenas sessão + organizações. |

## Notas de projeto

- **Índice parcial de papel de sistema**: o índice composto `(organizationId, key)` não
  cobre papéis de sistema (`organizationId = null`) porque NULL é distinto de NULL em SQL.
  Adicionamos `uniq_system_role_key` para garantir a invariante em banco.
- **Contexto por requisição** em vez de `AsyncLocalStorage` — mais robusto na cadeia de
  guards do Nest.
- **Alinhamento de endpoint (ARDEN-BE-002.1)**: o endpoint canônico de logout é
  `POST /session/logout` (operationId `session.logout`), conforme o contrato compartilhado
  e a OpenAPI. O adapter do frontend (`ApiSessionRepository.signOut`) foi corrigido para
  usar esse path (antes chamava `/session/sign-out`, que o backend nunca implementou). Não
  há endpoint duplicado nem alias; o nome de domínio `signOut` é preservado.

## Estado dos gates

Todos verdes localmente (ver `ARDEN_BE_002_TEST_EVIDENCE.md`): frontend
(typecheck/lint/test/build), backend (migrações/seed/bootstrap/typecheck/lint/unit/
integração/build) e E2E api-mode.
