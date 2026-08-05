# Arden.AS — Baseline de Segurança do Backend (ARDEN-BE-001)

> Fundação. **Autenticação e autorização reais NÃO são implementadas aqui** (entram
> no ARDEN-BE-002). Este documento descreve a segurança básica presente e os
> princípios que os módulos futuros deverão seguir.

## Presente nesta fundação

- **CORS por allowlist** (`CORS_ORIGINS`). Em **production**, `*` e allowlist vazia
  são **rejeitados na inicialização**. Origens não listadas não recebem cabeçalhos
  CORS.
- **Helmet** (`@fastify/helmet`) — cabeçalhos seguros.
- **Limite de body** (1 MiB) — proteção básica contra payloads grandes.
- **Timeout de requisição** (30s) no adapter Fastify.
- **Graceful shutdown** (`enableShutdownHooks`) — fecha conexões (ex.: Prisma).
- **Redaction de logs** — `Authorization`, cookies e tokens nunca são logados.
- **Erros sanitizados** — sem stack trace/SQL/segredos no corpo.
- **Configuração validada** — a aplicação não sobe com config inválida; segredos vêm
  de variáveis de ambiente e nunca são commitados.
- **Correlation ID** validado (formato/comprimento) — não confia em entradas grandes.

## Princípios para os módulos futuros (autoridade do backend)

- O **backend** é a autoridade sobre **autenticação, tenant, autorização e
  persistência**. O frontend **não** determina permissões nem tenant sem validação.
- **Tenant derivado da sessão**: o `organizationId` do path identifica o recurso, mas a
  autorização vem da sessão autenticada — o header/valor do cliente **não** é prova de
  acesso.
- **Autorização server-side por permissão** reutilizando o catálogo estável
  (`operation.view`, `operation.publish`, …).
- **Recurso de outro tenant → `RESOURCE_NOT_FOUND`** (não revelar existência).
- **Nenhuma regra crítica** deve ficar apenas no frontend.
- **Idempotência** e **concorrência otimista** (revision/If-Match) já têm
  infraestrutura pronta e devem ser aplicadas nos comandos críticos.

## Explicitamente fora do escopo (ARDEN-BE-001)

Login, JWT, cookies de sessão, Supabase/Auth0, RLS, MFA, recuperação de senha,
permissões reais, organizações/memberships reais. Nada disso é implementado — não há
"autenticação falsa" nem segurança de produção declarada sem evidência.
