# ARDEN-BE-001 — Relatório da Fundação do Backend

> Branch `claude/arden-be-001-foundation` · base `0c60b52` (PR #4). **Nenhuma
> funcionalidade de negócio** implementada. Contratos do ARDEN-FE-003 preservados.

## Entregue

- **Workspace monorepo** (npm workspaces): frontend permanece na raiz; `apps/api`
  (NestJS + Fastify) e `packages/contracts` (reexporta `src/contracts`). Sem mover o
  frontend (BE-D-002).
- **Aplicação backend inicializável** (`apps/api`), NestJS + Fastify, com bootstrap,
  build (`dist/main.js`) e execução verificada de ponta a ponta.
- **PostgreSQL + Prisma**: schema técnico, `Prisma Client`, `PrismaService`.
- **Migração inicial** (`20260731091709_init`) — tabelas `idempotency_records`,
  `application_metadata` (+ `_prisma_migrations`). Aplicada em banco limpo e idempotente
  em banco migrado (testes).
- **Configuração validada por Zod** — a app não sobe com config inválida; production
  rejeita CORS permissivo; `.env` no `.gitignore` + `.env.example`.
- **Health/Readiness**: `GET /health` (liveness), `GET /ready` (checa o banco → 503 se
  indisponível). Fora do prefixo.
- **API versionada** `/api/v1` + `GET /api/v1/meta` (versão/ambiente/commit).
- **OpenAPI servida** em `/api/docs` e `/api/docs/openapi.json` a partir do arquivo
  comitado (`docs/api/openapi-v1.yaml`) — sem gerar spec divergente.
- **Erros padronizados**: `AllExceptionsFilter` → envelope `ApiErrorResponse` do
  contrato, sempre com `correlationId`, sem stack/SQL/segredos.
- **Correlation ID**: middleware que aceita/gera/ecoa `X-Correlation-Id`, validado.
- **Logging estruturado (Pino)** com redaction de `Authorization`/cookies/tokens.
- **Segurança básica**: CORS allowlist, helmet, limite de body (1 MiB), timeout (30s),
  graceful shutdown.
- **Idempotência (infra)**: `IdempotencyService` + tabela (new/replay/conflict + purge),
  **não** aplicada a endpoints de negócio (inexistentes).
- **Concorrência otimista (utilitários)**: `assertRevision`/`parseIfMatch` →
  `VERSION_CONFLICT` (padrão documentado para módulos futuros).
- **Docker Compose** (postgres + api; pgAdmin em profile) + **Dockerfile** multi-stage.
- **CI** estendida: jobs `verify` (frontend + sync do OpenAPI), `e2e`, `backend` (com
  service container PostgreSQL) e `secrets` (higiene de segredos).
- **Testes**: 23 unitários + 16 de integração (backend), incluindo migração e
  idempotência sobre PostgreSQL real.
- **Contratos compartilhados**: o backend importa `@arden/contracts` (mesmo catálogo de
  erros/schemas), sem DTOs paralelos — teste arquitetural garante.
- **Documentação**: arquitetura, setup, configuração, estratégia de banco, erros/logging,
  baseline de segurança, decisões, + plano/relatório/evidência.

## Não incluído (fora de escopo)

Nenhum backend de negócio: sem login/JWT/cookies/Supabase/Auth0; sem organizações/
memberships/permissões reais; sem RLS; sem operações/versões/publicação/Gradientes/
auditoria de negócio; sem agentes/execuções/filas/workers/integrações/Work Units/
billing/arquivos/notificações/emails/WebSockets. Sem microsserviços/Kubernetes. **Nenhuma
autenticação falsa e nenhuma operação falsa** foram criadas.

## Contratos compartilhados (sem duplicação)

`packages/contracts` reexporta `src/contracts`; `@arden/contracts` é buildado e
consumido pelo backend (runtime + tipos). Reconciliação de estruturas de build
documentada. Nenhum DTO paralelo; nenhuma importação de React/Zustand no backend.

## Riscos remanescentes

- **Nada aqui é produção completa**: é a **fundação**. Autenticação, tenant e
  autorização server-side reais entram no ARDEN-BE-002.
- A infraestrutura de idempotência/concorrência existe mas **ainda não é aplicada** a
  endpoints (não há endpoints de negócio) — proposital.
- `packages/database` e `apps/web` não foram criados/movidos (risco aos PRs
  encadeados) — extração futura documentada (BE-D-006/BE-D-002).
- O build cross-workspace usa project references (contracts pré-buildado); documentado.

## Decisões pendentes

Ver `docs/backend/BACKEND_DECISIONS.md` (§ pendentes): provedor de autenticação (NÃO
DEFINIDO — ARDEN-BE-002), janela/escopo da Idempotency-Key, extração de
`packages/database`/`apps/web`.
