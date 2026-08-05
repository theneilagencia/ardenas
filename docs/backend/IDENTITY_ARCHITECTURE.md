# Arden.AS — Arquitetura de Identidade e Tenancy (ARDEN-BE-002)

> Primeira funcionalidade **real** do backend: autenticação, usuários internos,
> organizações, memberships, papéis, permissões, **autorização server-side**,
> **multitenancy** e auditoria de identidade. O backend é a **autoridade** — o
> frontend nunca decide identidade, tenant ou permissão.

## Princípio central

A identidade externa (login, senha, token) é responsabilidade **isolada** de um
provedor de identidade (Supabase Auth), atrás de um **adaptador** (`IdentityProvider`).
O banco do Arden é dono de tudo o que importa para o negócio: **perfil, organizações,
memberships, papéis, permissões, autorização e auditoria**.

- O Arden **nunca** armazena senha.
- As tabelas de auth do Supabase **nunca** são usadas como domínio de negócio.
- O e-mail **não** é identidade estável — a identidade é `(provider, subject)`.

```
Cliente ──Bearer token──▶ AuthenticationGuard ──verifyAccessToken──▶ IdentityProvider
                               │                                        (Supabase JWKS | Fake)
                               ▼
                       UserProvisioning (JIT por provider+subject)
                               ▼
   ActiveUserGuard ▶ OrganizationGuard ▶ PermissionGuard ▶ Controller
                               │                │
                               ▼                ▼
                    AuthorizationService   IdentityAuditService (append-only)
                    (permissões efetivas)
```

## Camadas

| Camada | Arquivos | Responsabilidade |
| --- | --- | --- |
| Provedor de identidade | `src/identity/identity.types.ts`, `supabase-identity.provider.ts`, `fake-identity.provider.ts`, `identity-provider.module.ts` | Verificar o token (assinatura/claims) e devolver `VerifiedIdentity`. Nada de negócio. |
| Provisionamento | `src/identity/user-provisioning.service.ts` | JIT: encontrar/criar o usuário interno por `(provider, subject)`. |
| Contexto de requisição | `src/identity/request-context.ts` | `AuthenticatedRequestContext` anexado à requisição pelos guards. |
| Autorização | `src/authz/authorization.service.ts`, `decorators.ts`, `guards/*` | Computar permissões efetivas e decidir acesso. |
| Sessão | `src/session/*` | Montar o `SessionContext` do contrato. |
| Organizações | `src/organizations/*` | Endpoints escopados por membership. |
| Auditoria | `src/identity/identity-audit.service.ts` | Registro append-only de eventos de identidade. |

## `IdentityProvider` (porta)

```ts
interface IdentityProvider {
  readonly name: string;
  verifyAccessToken(token: string): Promise<VerifiedIdentity>;
  getIdentity(subject: string): Promise<ExternalIdentity | null>;
}
```

`VerifiedIdentity` carrega `provider`, `subject` (imutável), `email`, `emailVerified`,
`issuedAt`, `expiresAt` e `claims`. A seleção do provedor concreto é feita **uma vez**,
por configuração (`AUTH_PROVIDER`), em `identity-provider.module.ts` — sem fallback
silencioso.

## Contexto de requisição

Optamos por **anexar o contexto à requisição** (chave `ardenContext` no `FastifyRequest`)
em vez de `AsyncLocalStorage`: é robusto através da cadeia de guards do Nest e explícito.
Cada guard enriquece o contexto (usuário → organização → permissões). O decorator
`@CurrentContext()` injeta o contexto já validado nos controllers.

## Cadeia de guards (global)

Registrada como `APP_GUARD` em ordem determinística:

1. **AuthenticationGuard** — verifica o Bearer, provisiona (JIT) e inicia o contexto.
2. **ActiveUserGuard** — bloqueia usuário não `ACTIVE`.
3. **OrganizationGuard** — resolve o tenant do path, valida membership/organização.
4. **PermissionGuard** — exige as permissões declaradas.

Decorators declarativos controlam a cadeia: `@Public`, `@RequireOrganization`,
`@RequirePermission`. Rotas técnicas (`/health`, `/ready`, `/api/v1/meta`, `/api/docs`)
são `@Public`.

## O que NÃO está aqui

Operações, versões, autoridade e auditoria **de negócio** não são implementadas nesta
issue. O objetivo funcional é: um usuário autenticado consulta a sua sessão, vê apenas
as suas organizações, seleciona uma organização válida e recebe as permissões efetivas
computadas no servidor.

Ver também: `AUTHENTICATION_WITH_SUPABASE.md`, `AUTHORIZATION_MODEL.md`,
`MULTITENANCY_ENFORCEMENT.md`, `ORGANIZATION_AND_MEMBERSHIP_MODEL.md`.
