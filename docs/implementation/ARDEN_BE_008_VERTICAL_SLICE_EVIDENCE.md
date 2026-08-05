<!-- Milestone: ARDEN-BE-008.7 -->
# ARDEN-BE-008 — Evidência do vertical slice offline

Componentes reais: frontend construído em modo `api`, backend NestJS+Fastify, PostgreSQL
16, worker real, **FakeAnthropicTransport**, cofre real com fixture de teste, approvals,
audit e evidence reais. **Rede externa: zero.**

## 1. Slice automático (fluxo READ, sem approval)
Coberto por `anthropic-runtime.integration.spec.ts` + `anthropic-tool-calling.
integration.spec.ts` + E2E `anthropic-admin-api.spec.ts`:
```
login → org Alpha → Anthropic admin → catálogo → criar connection →
secret write-only → validar configuração local (NOT_VERIFIED) →
ModelConfiguration DRAFT → AgentDefinition → AgentVersion (config Anthropic) →
structured output + tool policy → publicar em ambiente test-only →
OperationVersion com agent.execute → executar →
provider propõe READ tool → authority ALLOW → ExternalToolExecutor →
tool_result sanitizado → continuation → structured output →
evaluation PASSED → governance WITHIN_LIMITS → usage persistida → cost null →
resultado exibido → audit → evidence
```
Resultado observado: `model calls = 2`, `tool calls = 1`, `approvals = 0`, `cost = null`,
`production = blocked`, `external network = zero`.

## 2. Slice supervisionado (fluxo WRITE, com approval)
Coberto pelas suites de tool calling + approval/checkpoint (BE-007.5):
```
provider propõe WRITE tool → REQUIRE_APPROVAL → run PAUSED → approval criado →
nenhuma tool executada → operador aprova → resume →
authorization single-use → ExternalToolExecutor uma vez → tool_result →
continuation → final output → result SUCCEEDED
```
Comprovado: approval único, tool executada uma vez, replay/restart seguros (model call
inicial não repetida), custo null, segredo ausente.

## 3. Matriz de falhas
Nenhum cenário inseguro termina como sucesso. Coberto pelas integrações do milestone:
credential revogada, cross-tenant connection (404), provider disabled, production
environment (`MODEL_PROVIDER_DISABLED`), invalid output (não vira sucesso), unknown tool,
invalid tool input, prompt injection no tool_result (detectada/isolada), rate limit +
retry (adapter controla; SDK retry off), timeout before send (retry), timeout after send
(UNKNOWN, sem retry cego), model UNKNOWN após tool, tool UNKNOWN, rotation invalida smoke,
revision conflict (limpa segredo, sem auto-retry), idempotent replay.

## 4. Smoke real
`LIVE SMOKE: NOT EXECUTED` — sem credencial oficial de teste e sem autorização de
operador. Produção permanece bloqueada; nenhum relatório afirma verificação ao vivo.
