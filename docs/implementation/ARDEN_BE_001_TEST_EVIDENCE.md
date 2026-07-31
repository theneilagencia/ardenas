# ARDEN-BE-001 — Evidência de Testes

> Branch `claude/arden-be-001-foundation`. Scripts reais de `package.json`.

## Gates obrigatórios (§29)

### Gates existentes (frontend)

| Comando | Status | Testes | Falhas | Observação |
|---|---|---|---|---|
| `npm run typecheck` | PASS | — | 0 | frontend |
| `npm run lint` | PASS | — | 0 | frontend |
| `npm run test` | PASS | 103 | 0 | 14 arquivos |
| `npm run test:a11y` | PASS | 1 | 0 | axe |
| `npm run build` | PASS | — | 0 | PWA |
| `npm run test:e2e` | PASS | 9 | 0 | Playwright |
| `npm run contracts:openapi` | PASS | — | 0 | OpenAPI válido (17 paths); sincronizado |

### Novos gates (backend)

| Comando | Status | Testes | Falhas | Observação |
|---|---|---|---|---|
| `npm run typecheck:api` | PASS | — | 0 | `tsc -p` |
| `npm run lint:api` | PASS | — | 0 | eslint (flat, sem warnings) |
| `npm run test:api` | PASS | 23 | 0 | 7 arquivos (unitários) |
| `npm run test:api:integration` | PASS | 16 | 0 | 3 arquivos (PostgreSQL real) |
| `npm run build:api` | PASS | — | 0 | `dist/main.js` |
| `npm run db:migrate:status` | PASS | — | 0 | "Database schema is up to date" |

## Testes exigidos (§21) e onde estão

| Requisito | Arquivo |
|---|---|
| App inicia com configuração válida | `test/app.integration.spec.ts` (boot) |
| App falha com config obrigatória ausente | `src/config/env.schema.spec.ts` |
| `/health` retorna 200 | `test/app.integration.spec.ts` |
| `/ready` 200 com banco disponível | `test/app.integration.spec.ts` |
| `/ready` falha sem banco | `src/health/health.controller.ts` (503; ping try/catch) |
| `/api/v1/meta` retorna versão | `test/app.integration.spec.ts` |
| Correlation ID enviado é preservado | `test/app.integration.spec.ts`, `src/common/middleware/correlation-id.spec.ts` |
| Correlation ID ausente é gerado | idem |
| Erro inclui correlation ID | `test/app.integration.spec.ts` |
| Erro não inclui stack trace | `test/app.integration.spec.ts` |
| Validação rejeita input inválido | `src/common/validation/zod-validation.pipe.spec.ts` |
| CORS bloqueia origem não autorizada | `test/app.integration.spec.ts` |
| Logs ocultam Authorization | `src/common/logging/redaction.spec.ts` |
| Migration aplica em banco limpo | migração aplicada; `test/migration.integration.spec.ts` |
| Migration idempotente (aplicada uma vez) | `test/migration.integration.spec.ts` (deploy) |
| Idempotency detecta chave repetida | `src/modules/idempotency/idempotency.service.spec.ts`, `test/idempotency.integration.spec.ts` |
| Mesma chave + body diferente → conflito | idem |
| OpenAPI servida é válida | `test/app.integration.spec.ts` (`/api/docs/openapi.json`) |
| Backend importa contratos compartilhados | `src/architecture.spec.ts` |
| Backend não importa React/Zustand | `src/architecture.spec.ts` |
| Concorrência otimista (VERSION_CONFLICT) | `src/common/concurrency/optimistic-concurrency.spec.ts` |

## Reproduzir o backend localmente

```bash
docker compose up -d postgres           # ou PostgreSQL local em 5432
cp apps/api/.env.example apps/api/.env
npm run db:generate && npm run db:migrate
npm run test:api                        # unitários
npm run test:api:integration            # integração (usa arden_test)
```

## Verificação manual (smoke)

```
GET /health            → 200 {status:"ok"}
GET /ready             → 200 {checks:{database:true}}
GET /api/v1/meta       → 200 {apiVersion:"v1",...}
GET /api/docs/openapi.json → 200 (OpenAPI 3.0.3)
GET /api/v1/rota-x     → 404 {error:{code:"RESOURCE_NOT_FOUND",correlationId:...}}
Origin não autorizada  → sem Access-Control-Allow-Origin
```
