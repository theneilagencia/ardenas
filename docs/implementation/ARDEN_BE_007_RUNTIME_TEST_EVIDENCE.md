# ARDEN-BE-007.3 — Evidência de testes (runtime determinístico)

## Ambiente
PostgreSQL 16 real (cluster local) + fila durável + worker real. `AUTH_PROVIDER=fake`.
Sem internet, sem SDK comercial. `NODE_ENV=test` (produção simulada por override pontual).

## Testes unitários (`npm run test:api`) — 342 passed (37 novos do runtime)
- `runtime/internal-test-model.provider.spec.ts` (9): cenários por modelId, buildValidOutput,
  allowlist, sem tool calls, kinds de erro.
- `runtime/agent-runtime.spec.ts` (18): sucesso+usage; inválido→AGENT_OUTPUT_INVALID;
  repairable→SUCCEEDED (modelCallCount=2, repairAttemptCount=1); repair exhausted; timeout/
  rate-limit/provider-error/content-filtered/unknown; tool calling rejeitado; input inválido;
  token limit; injeção bloqueada; required path; llm-judge não suportado; canário de segredo.
- `runtime/runtime-units.spec.ts` (12): registry (conhecido/desconhecido), validador
  (válido/inválido/bytes), avaliador (required/forbidden/llm-judge), assembler (redação/sinal),
  estimador de tokens.

## Testes de integração (PostgreSQL + worker real) — `agent-runtime.integration.spec.ts` (8)
| Cobertura | Resultado |
| --- | --- |
| **§35** E2E: agent.execute → structured output válido → step SUCCEEDED + evidência + usage + auditoria; job mínimo `{executionRunId}` | ✓ |
| **§36** repair: 1ª inválida + 2ª válida → SUCCEEDED (modelCallCount=2, repairAttemptCount=1) | ✓ |
| **§36** repair exhausted: todas inválidas → step FAILED `AGENT_OUTPUT_REPAIR_EXHAUSTED` | ✓ |
| **§37** unknown: resultado incerto → step FAILED (não SUCCEEDED); evento `agent.execution_unknown` | ✓ |
| **§38** canário: campo sensível injetado NÃO vaza para job/eventos/evidência/audit/output/error | ✓ |
| **§39** cross-tenant: operação Alpha com agentKey só existente em Beta → execução recusada (fail-fast) | ✓ |
| **§36** produção: em `NODE_ENV=production` o runtime não executa `internal.test-model` → step FAILED `MODEL_PROVIDER_DISABLED` | ✓ |
| reprocessamento: `worker.drain` repetido não altera o step terminal nem duplica `agent.execution_completed` | ✓ |

## Suíte completa (`npm run test:api:integration`) — 28 arquivos, 215 testes, exit 0
Todas as suítes anteriores (identidade/operações/versões/políticas/aprovações/enforcement/
execução/conectores/webhooks/agentes-persistência) continuam verdes com o runtime integrado
e o endurecimento de redação do recorder. Sem regressão.

## Outros gates
typecheck/lint (fe+api) ✓ · test (fe 214) ✓ · a11y (2) ✓ · build (fe+api) ✓ ·
contracts:openapi determinístico **sem diff** ✓ · migrate deploy/status sem drift ✓ ·
seed idempotente (2×) ✓ · nenhum SDK de LLM instalado · nenhuma migration criada ·
worker/processor/queue inalterados funcionalmente.
