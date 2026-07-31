# Arden.AS — Arquitetura do Backend v1 (ARDEN-BE-001)

> Fundação técnica. **Sem funcionalidades de negócio** (sessão, operações, versões,
> autoridade, auditoria de negócio). O backend será a **autoridade** sobre
> autenticação, tenant, autorização e persistência — nada disso é implementado aqui.

## Forma

Monólito modular (NestJS + Fastify), no workspace `apps/api`, dentro do monorepo
`ardenas`. Contratos compartilhados via `@arden/contracts` (reexporta `src/contracts`,
ARDEN-FE-003). PostgreSQL via Prisma. Logs estruturados via Pino.

```
ardenas/
├── apps/api/            # backend NestJS (esta issue)
├── packages/contracts/  # reexporta src/contracts (sem duplicar)
├── src/                 # frontend (permanece na raiz — BE-D-002)
├── docs/                # documentação (api/, backend/, implementation/, architecture/)
└── docker-compose.yml   # postgres + api
```

## Módulos (apps/api/src)

- `config/` — validação de ambiente por Zod (`env.schema`), `ConfigModule` global.
- `common/`
  - `errors/` — `ApiException` (usa o catálogo de `@arden/contracts`).
  - `filters/` — `AllExceptionsFilter` → envelope `ApiErrorResponse` sanitizado.
  - `middleware/` — `CorrelationIdMiddleware`.
  - `logging/` — `LoggerModule` (Pino + redaction).
  - `validation/` — `ZodValidationPipe`.
  - `concurrency/` — utilitários de concorrência otimista (`assertRevision`, `parseIfMatch`).
- `database/` — `PrismaService` + `DatabaseModule`.
- `health/` — `/health`, `/ready`.
- `meta/` — `/api/v1/meta`.
- `docs/` — serve o OpenAPI comitado em `/api/docs`.
- `modules/idempotency/` — `IdempotencyService` (infra técnica).

## Fluxo de requisição

1. `CorrelationIdMiddleware` resolve/gera `X-Correlation-Id` (ecoado na resposta).
2. Pino (nestjs-pino) loga método, path, status, duração, correlationId, ambiente,
   versão — com redaction de `Authorization`/cookies/tokens.
3. Handlers técnicos (health/ready/meta/docs). Erros passam pelo
   `AllExceptionsFilter`, que serializa o envelope tipado (sem stack/SQL/segredos).

## Prefixo e versionamento

`/api/v1` para endpoints de negócio (nenhum ainda, exceto `/api/v1/meta`). `/health`,
`/ready`, `/api/docs` ficam **fora** do prefixo.

## Contratos compartilhados

`@arden/contracts` reexporta `src/contracts`. O backend consome o **mesmo** catálogo
de erros, os mesmos schemas e os mesmos descritores de endpoint — garantido por teste
arquitetural (sem DTOs paralelos, sem React/Zustand no backend).

## Autoridade (o que vem depois)

Autenticação real, tenant server-side, autorização por permissão, RLS e as entidades
de negócio (usuários, organizações, operações, versões, auditoria) entram no
**ARDEN-BE-002+**. A fundação apenas prepara a infraestrutura (idempotência,
concorrência, erros, observabilidade) para esses módulos.
