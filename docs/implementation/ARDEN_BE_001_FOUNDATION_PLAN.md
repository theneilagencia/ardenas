# ARDEN-BE-001 — Plano da Fundação do Backend

> Branch `claude/arden-be-001-foundation` · base `0c60b52` (PR #4). Fundação técnica
> do backend, **sem funcionalidades de negócio**, preservando integralmente os
> contratos do ARDEN-FE-003.

## Objetivo

Criar a infraestrutura mínima e funcional do backend: aplicação inicializável,
PostgreSQL, Prisma, migrations, configuração validada, health/readiness, API
versionada, OpenAPI servida, erros padronizados, correlation ID, logging estruturado,
idempotência (infra), concorrência (utilitários), Docker Compose, CI e testes.

## Arquitetura

Monólito modular (NestJS + Fastify) em `apps/api`; contratos compartilhados via
`packages/contracts` (reexporta `src/contracts`). Frontend permanece na raiz
(BE-D-002). Ver `docs/backend/BACKEND_ARCHITECTURE_V1.md` e `BACKEND_DECISIONS.md`.

## Escopo

Config validada (Zod) · PostgreSQL + Prisma · migração inicial (tabelas técnicas) ·
`/health`, `/ready`, `/api/v1/meta` · OpenAPI em `/api/docs` (arquivo comitado) ·
filtro global de erros · correlation ID · logging Pino com redaction · CORS allowlist
+ helmet + limite de body + timeout + graceful shutdown · `IdempotencyService` +
tabela · utilitários de concorrência otimista · Docker Compose (postgres + api) · CI
(frontend + backend + segredos) · testes unitários e de integração.

## Fora de escopo

Login/JWT/cookies/Supabase Auth/Auth0; organizações/memberships/permissões reais; RLS;
operações/versões/publicação/Gradientes/auditoria de negócio; agentes; execuções;
filas; workers; integrações; Work Units; billing; arquivos; notificações; emails;
WebSockets. Microsserviços e Kubernetes são proibidos.

## Estratégia de contratos

`@arden/contracts` reexporta `src/contracts` — o backend usa o **mesmo** catálogo de
erros e os mesmos schemas, sem DTOs paralelos (teste arquitetural). Migração de
`src/contracts` para um package próprio e de `packages/database`/`apps/web` ficam
documentadas como futuras.

## Gates

Frontend (7): typecheck, lint, test, test:a11y, build, test:e2e, contracts:openapi.
Backend (6): typecheck:api, lint:api, test:api, test:api:integration, build:api,
db:migrate:status. Todos devem passar; o CI usa um service container PostgreSQL.
