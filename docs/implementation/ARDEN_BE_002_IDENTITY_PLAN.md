# ARDEN-BE-002 — Plano de Identidade e Tenancy

> Plano de execução para a primeira funcionalidade real do backend: autenticação,
> organizações, memberships, papéis, permissões, autorização server-side, multitenancy
> e auditoria de identidade. Base: `claude/arden-be-001-foundation` (PR da fundação).

## Objetivo funcional

Um usuário autenticado consulta a sua sessão (`GET /api/v1/session`), vê **apenas** as
suas organizações, seleciona uma organização válida e recebe as **permissões efetivas
computadas no servidor**. Sem operações/versões/agregados de negócio.

## Decisões-chave

1. **Supabase Auth isolado atrás de um adaptador** (`IdentityProvider`). O Supabase só
   cuida de identidade/login/token; o Arden é dono de perfil/orgs/memberships/papéis/
   permissões/autorização/auditoria. Nunca armazenar senha; nunca usar tabelas de auth
   como domínio.
2. **Verificação criptográfica do token** (JWKS/assinatura, issuer, audience, exp/nbf,
   algoritmos restritos). Nunca aceitar JWT só decodificado; nunca exigir `service_role`.
3. **Provedor fake** para dev/testes, **bloqueado em production**, sem fallback silencioso.
4. **Provisionamento JIT** por `(provider, subject)`; e-mail não é identidade; subject
   imutável; sem auto-criação de org/membership; sem auto-admin.
5. **Contexto anexado à requisição** (não `AsyncLocalStorage`) para robustez na cadeia
   de guards.
6. **Cadeia de guards** separada: Authentication → ActiveUser → Organization → Permission.
7. **Anti-enumeração**: 404 para org inexistente e sem-membership; 403 específico para
   suspensões.
8. **Catálogo de permissões** importado da fonte única do frontend; seed idempotente.
9. **Bootstrap seguro** por CLI (idempotente, `--dry-run`, confirmação, sem segredos),
   nunca endpoint público.
10. **Auditoria append-only** com redação de sensíveis.

## Etapas

| # | Etapa | Entregáveis |
| --- | --- | --- |
| 1 | Modelo de dados + migração | `schema.prisma`, migração `identity_tenancy` (+ índice parcial de papel de sistema) |
| 2 | Provedor de identidade | interface, `SupabaseIdentityProvider` (JWKS), `FakeIdentityProvider`, módulo global |
| 3 | Provisionamento + contexto | `UserProvisioningService`, `request-context` |
| 4 | Autorização + guards | `AuthorizationService`, decorators, 4 guards globais |
| 5 | Sessão + organizações | `/session` (+ refresh/switch/logout), `/organizations` |
| 6 | Seed + bootstrap | `seed.ts` (catálogo), `bootstrap-organization.ts` (CLI) |
| 7 | Testes | unit, integração (Postgres real), multitenancy crítico, E2E api-mode |
| 8 | Docs + CI | 8 docs backend + 3 de implementação; gates de identidade/seed/bootstrap/E2E |

## Gates

- Frontend: typecheck, lint, test (unit+a11y), build, OpenAPI em sincronia.
- Backend: migrações (deploy/status), seed idempotente, bootstrap (dry-run), typecheck,
  lint, unit, integração, build.
- E2E api-mode: sessão + organizações contra o backend real, sem fallback para mock.
- Higiene de segredos: sem `.env` versionado, sem segredos óbvios.

## Fora de escopo

Operações, versões, autoridade e auditoria de negócio. Endpoints de domínio
(`/operations`, `/people`, etc.) permanecem não implementados nesta issue.
