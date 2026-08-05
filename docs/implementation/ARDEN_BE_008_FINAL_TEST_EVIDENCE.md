<!-- Milestone: ARDEN-BE-008.7 -->
# ARDEN-BE-008 — Evidência final de testes

Todos os números abaixo foram executados nesta fase de encerramento contra Postgres 16
local (fixture de teste) e Chromium headless. Nenhuma rede externa foi usada.

## Gates locais

| Gate | Comando | Resultado |
| --- | --- | --- |
| Frontend typecheck | `npm run typecheck` | PASS |
| Frontend lint | `npm run lint` | PASS |
| Frontend unit + a11y | `npm run test` | **271 passed** (40 files) |
| Frontend build | `npm run build` | PASS |
| OpenAPI | `npm run contracts:openapi` | PASS — sem drift |
| Backend typecheck | `npm run typecheck:api` | PASS |
| Backend lint | `npm run lint:api` | PASS |
| Backend unit | `npm run test:api` | **512 passed** (49 files) |
| Backend integration | `npm run test:api:integration` | **264 passed** (35 files) |
| Backend build | `npm run build:api` | PASS |
| Migrations deploy | `npm run db:migrate:deploy` | 11 migrations aplicadas |
| Migrations status | `npm run db:migrate:status` | up-to-date, sem drift |
| Seed idempotente | `npm run db:seed` (×2) | 2ª execução `+0` inserts em todas as projeções |
| Offline E2E (Anthropic admin) | `playwright.api.config.ts` | **4 passed** |

Total de testes automatizados verdes: **271 (frontend) + 512 (backend unit) + 264
(backend integração) + 4 (E2E) = 1051**. Falhas: **0**.

## Cobertura Anthropic específica (subconjunto)
- `anthropic-connection.integration.spec.ts` — 8 testes: catálogos persistidos, credencial
  write-only + canário de cofre, validação local `NOT_VERIFIED_WITH_PROVIDER`, rotação,
  ModelConfiguration DRAFT + ativação bloqueada + rejeição de modelId fora da allowlist,
  **cross-tenant 404**, seed idempotente.
- `anthropic-runtime.integration.spec.ts`, `anthropic-tool-calling.integration.spec.ts`,
  `anthropic-smoke-test.integration.spec.ts` — runtime, tool calling offline (fake
  transport), smoke CLI-only.
- `anthropic-sdk-boundary.spec.ts`, `anthropic-safety.spec.ts` — guards arquiteturais.
- `env.schema.spec.ts` — guard da fixture `CONNECTOR_MASTER_KEY` (production recusa; test
  aceita; chave real aceita).
- Frontend: `AnthropicModelCatalog/Connections/ModelConfiguration.test.tsx`,
  `AnthropicAdminPage.{test,a11y}.tsx`, `AgentVersionEditorPage.test.tsx`,
  `ExecutionAgentUsagePanel.test.tsx`.
- E2E: `e2e/api/anthropic-admin-api.spec.ts` — fixture não produtiva, connection segura +
  canário de segredo no DOM real + validação, rotação-invalidação, ModelConfiguration
  DRAFT bloqueada.

## Verificações live
```
Live smoke:          NOT EXECUTED
Live authentication: NOT EXECUTED
Live structured output: NOT EXECUTED
Live usage:          NOT EXECUTED
Live tool calling:   NOT EXECUTED
```
Sem credencial oficial de teste e sem autorização de operador → não executadas. Isso NÃO
reprova o milestone: produção permanece bloqueada, os relatórios não afirmam verificação
ao vivo, e o vertical slice offline está completo.
