<!-- Milestone: ARDEN-SCOPE-002 -->
# ARDEN-SCOPE-002 — Evidência de testes

Commit da branch de gap-closure. PostgreSQL 16 local, banco limpo. Chromium real
(`ARDEN_CHROMIUM_PATH`).

| Gate | Resultado |
| --- | --- |
| typecheck / lint / build (frontend) | PASS |
| test (frontend unit + a11y + infra) | **306** PASS (+1 assessment) |
| test:a11y | 3 PASS |
| contracts:openapi | **zero drift** |
| typecheck:api / lint:api / build:api | PASS |
| test:api (unit) | **555** PASS |
| test:api:integration | **271** PASS (267 + 4 seed) |
| test:api:execution:integration | 10 PASS |
| db:migrate:deploy / status / seed×2 | PASS (11 migrations; **sem nova migração**) |
| infrastructure:contracts/alerts/runbooks:validate | PASS |
| artifact:build / verify | PASS |
| infrastructure:decision:validate | **EXPECTED_BLOCK** |
| master-key:drill (offline) | PASS |
| **E2E demo** (`test:e2e`) | **9/9** PASS |
| **E2E api-mode** (`test:e2e:api`) | **10/10** PASS |

**Falhas: 0.** A primeira tentativa de E2E falhou por binário de navegador do Playwright no
sandbox (ambiente), corrigida via `ARDEN_CHROMIUM_PATH`; reexecução verde.

## Cobertura de fechamento
- GAP-008: 6 seeds paralelos sem duplicata + suíte estável 271/271.
- GAP-002: providers/architecture tests verdes; nenhum ref a repositório removido.
- GAP-005: repository test cria operação real em api (não lança).
- GAP-007: agregados de execução/uso já testados (agent-governance, execution-flow).

## Segurança
Cross-tenant 404 (multitenancy + operations-api E2E); canário de segredo ausente do DOM
(anthropic-admin-api E2E) e de DB/log/auditoria (specs de vault); Anthropic DISABLED.
