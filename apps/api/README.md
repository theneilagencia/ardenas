# Arden.AS API (@arden/api)

Fundação do backend (ARDEN-BE-001) — NestJS + Fastify + Prisma + PostgreSQL + Pino.
**Sem funcionalidades de negócio** nesta etapa: apenas a infraestrutura (config,
banco, health, observabilidade, erros, idempotência, docs). Consome os contratos
compartilhados de `@arden/contracts` (fonte: `src/contracts`, ARDEN-FE-003).

## Setup local

```bash
cp apps/api/.env.example apps/api/.env      # ajuste DATABASE_URL
docker compose up -d postgres               # ou um PostgreSQL local
npm run db:migrate                          # aplica a migração inicial
npm run dev:api                             # sobe a API
```

Detalhes em `docs/backend/BACKEND_LOCAL_SETUP.md`.

## Endpoints técnicos

- `GET /health` — liveness (fora do prefixo).
- `GET /ready` — readiness (checa o banco; 503 se indisponível).
- `GET /api/v1/meta` — versão/ambiente/commit.
- `GET /api/docs` e `GET /api/docs/openapi.json` — contrato OpenAPI v1 servido.

## Scripts (a partir da raiz)

`dev:api`, `build:api`, `start:api`, `typecheck:api`, `lint:api`, `test:api`,
`test:api:integration`, `db:generate`, `db:migrate`, `db:migrate:deploy`,
`db:migrate:status`, `db:reset:test`.
