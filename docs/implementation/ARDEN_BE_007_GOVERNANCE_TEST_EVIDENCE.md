# ARDEN-BE-007.6 — Evidência de testes (avaliação/usage/custo/governança/observabilidade)

Todos os gates executados contra PostgreSQL 16 real + fila durável + worker real. Provider
determinístico interno (`internal.test-model`, proibido em produção). Sem internet, SDK ou
billing.

## Gates (§51) — todos PASS

| Gate | Comando | Resultado |
| --- | --- | --- |
| Root typecheck | `npm run typecheck` | PASS |
| Root lint | `npm run lint` | PASS (0 warnings) |
| Root test | `npm run test` | 26 arquivos, **214** testes PASS |
| Root a11y | `npm run test:a11y` | 2 testes PASS |
| Root build | `npm run build` | PASS |
| OpenAPI | `npm run contracts:openapi` | **96 paths** válidos |
| API typecheck | `npm -w apps/api run typecheck` | PASS |
| API lint | `npm -w apps/api run lint` | PASS (0 warnings) |
| API unit | `npm -w apps/api run test` | 40 arquivos, **410** testes PASS |
| API integração | `npm -w apps/api run test:integration` | 31 arquivos, **238** testes PASS |
| API build | `npm -w apps/api run build` | PASS |
| Migração status | `db:migrate:status` | up to date (10 migrações) |
| Seed ×2 | `db:seed` | idempotente (rate cards +0/~19) |

## Testes de unidade (`src/agents/governance/governance-units.spec.ts` — 20 testes)

- **estimateCost**: rate card zero conhecida → custo `0`/USD (não null); rate card ausente →
  `null` + `COST_RATE_CARD_NOT_AVAILABLE`; cálculo por componente com `ceil` (3 + 8 = 11);
  inteiro sem float; tokens 0 → 0.
- **AgentUsageAggregator**: soma tokens/contadores; usage negativa → `problems[]`;
  `cachedInputTokens > inputTokens` → `problems[]`.
- **AgentEvaluationEngine**: PASSED (tudo ok); FAILED (output eval false / schema inválido /
  UNKNOWN / sinal crítico / aprovação pendente); PARTIAL (só warning); NOT_RUN (não avaliou).
- **AgentGovernanceEvaluator**: WITHIN_LIMITS; LIMIT_EXCEEDED (erro de token / custo > teto);
  BLOCKED (sinal crítico); LIMIT_WARNING (≥80% do teto).

## Testes de integração (`test/agent-governance.integration.spec.ts` — 11 testes, E2E)

| § | Cenário | Verifica |
| --- | --- | --- |
| §42 | SUCCEEDED | usage>0, custo `0`/USD (não null), rateCardId, eval PASSED, gov WITHIN_LIMITS, output VALID, linha de model_call |
| §42 | rate card ausente | custo `null`, currency `null`, warning `COST_RATE_CARD_NOT_AVAILABLE`, evento `agent.cost_rate_card_missing` |
| §43 | output inválido | status FAILED, eval FAILED, output INVALID, checks presentes |
| §43 | UNKNOWN | NUNCA PASSED; eval ≠ PASSED |
| §44 | rollups | ORGANIZATION/OPERATION/AGENT_VERSION incrementados 1×; **replay não duplica** rollup/custo/model_call |
| §45 | admin queries | lista (filtro status/run), detalhe, usage por operação, usage por execução |
| §45 | paginação | cursor devolve páginas disjuntas |
| §45 | cross-tenant | detalhe de outro tenant → 404 `AGENT_RESULT_NOT_FOUND`; lista vazia |
| §46 | governança | WITHIN_LIMITS dentro dos limites |
| §47 | canário de segredo | segredo do input ausente em result/usage/rollup/eventos/evidência/audit/métricas |
| §48 | observabilidade | `arden_agent_executions_total` +1 por execução terminal; replay não re-emite |

## Não-regressão

Suítes de agente anteriores permanecem verdes com o recorder ligado:
`agent-runtime` (8), `agent-tool-calling` (7), `agent-context` (5) — nenhuma vaza segredo
para as novas tabelas. Custo `internal.test-model` = 0 USD em todos os cenários.

## Invariantes FAIL confirmados como não violados

Custo ausente ≠ zero (null + warning); dinheiro só em BigInt; usage negativa detectada;
replay não duplica custo/tokens/rollup; output inválido/UNKNOWN nunca PASSED; unknown nunca
vira sucesso; sem vazamento cross-tenant; prompt/segredo nunca persistido; sem billing.
