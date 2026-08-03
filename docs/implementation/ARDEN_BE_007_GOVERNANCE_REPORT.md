# ARDEN-BE-007.6 — Avaliação final, usage, custo estimado, governança e observabilidade

Fecha o ciclo operacional do agente: todo `agent.execute` produz um REGISTRO OPERACIONAL
persistido e consultável — avaliação determinística FINAL, usage por chamada, custo estimado
inteiro (rate cards internas versionadas), governança de limites e observabilidade. Sobre a
infraestrutura do BE-005 (execução/evidência/auditoria), BE-007.3/.4 (runtime/contexto) e
BE-007.5 (tool calling). **Sem** provider comercial, SDK, internet, billing/invoice/wallet,
LLM-as-judge como critério final, frontend ou execução direta.

## Fluxo canônico

```
AgentStepExecutor (após persistTrail)
  → AgentOperationalResultRecorder.record(outcome)
      → AgentUsageAggregator      (soma tokens/contadores; valida não-negativo/cached≤total)
      → ModelRateCardsRepository  (rate card ATIVA por provider/version/model; ausente → null)
      → AgentCostEstimator        (ceil(tokens × rate / 1e6) por componente, BigInt; sem float)
      → AgentEvaluationEngine     (11 checks determinísticos → PASSED/PARTIAL/FAILED/NOT_RUN)
      → AgentGovernanceEvaluator  (WITHIN_LIMITS/LIMIT_WARNING/LIMIT_EXCEEDED/BLOCKED)
      → TX: upsert result + model_call_usage + tool_call_usage + rollups(8 dims, 1×/terminal)
             + audit(agent.result_recorded) + evidência(DECISION) + eventos(cost/limit)
      → métricas arden_agent_* (após TX, 1×/terminal)
```

## Modelo de dados (migração `20260803150000_agent_usage_evaluation_governance`)

| Tabela | Unique | Papel |
| --- | --- | --- |
| `agent_execution_results` | `execution_step_id` | 1 registro operacional por etapa (ver `AGENT_OPERATIONAL_RESULT.md`) |
| `agent_model_call_usage` | `(step, call_index)` | usage/custo por chamada de modelo |
| `agent_tool_call_usage` | `(step, tool_call_id)` | usage por tool call (risco/decisão/autorização) |
| `agent_usage_rollups` | 7-tupla | agregados diários UTC por 8 dimensões |
| `model_rate_cards` | `(provider, version, model, status)` | catálogo interno de preço estimado |

Enums: `AgentResultStatus`, `AgentOutputValidationStatus`, `AgentEvaluationStatus`,
`AgentGovernanceStatus`, `AgentModelCallPurpose`, `ModelRateCardStatus`,
`AgentUsageRollupDimension`. Migração ADITIVA (só novas tabelas/enums).

## Componentes novos (`apps/api/src/agents/governance/`)

| Arquivo | Papel |
| --- | --- |
| `agent-usage-aggregator.ts` | PURO. Soma usage; devolve `problems[]` (negativo/cached>total). |
| `agent-cost-estimator.ts` | PURO. `ceilDiv` BigInt por componente; ausente → `null` + warning. |
| `agent-evaluation-engine.ts` | PURO. 11 checks; decisão FINAL nunca por LLM. |
| `agent-governance-evaluator.ts` | PURO. Status/reasonCode/action de limites e sinal crítico. |
| `agent-metrics.ts` | Registro in-memory `arden_agent_*` (labels de baixa cardinalidade) + log. |
| `rate-card.projector.ts` | Projeção idempotente do catálogo + `ModelRateCardsRepository`. |
| `agent-operational-result.recorder.ts` | Orquestra tudo e PERSISTE (idempotente por terminal). |
| `agent-results.serializers.ts` | DB → contrato (BigInt→number, sem conteúdo). |
| `agent-results.service.ts` | Consultas admin (cursor, groupBy, 404 cross-tenant). |
| `agent-results.controller.ts` | 4 GET tenant-scoped (`agent.view`/`agent.cost.view`). |

## Contratos e OpenAPI

`agent-operational-result.schema.ts` (status/summaries/result/bucket/rate card),
`model-rate-card-catalog.ts` (19 IDs `internal.test-model` = 0 USD), `agent-results.contract.ts`
(queries + 4 endpoints). Registrados no `registry.ts` (schemaRegistry + endpoints).
Erros novos: `AGENT_RESULT_NOT_FOUND` (404), `AGENT_GOVERNANCE_BLOCKED` (409),
`AGENT_USAGE_INVALID` (422). OpenAPI regenerado (96 paths) + cliente tipado.

## Invariantes (FAIL conditions da spec)

- Custo ausente → `null` + warning, **nunca** zero inventado.
- Dinheiro só em INTEIRO (BigInt); zero float.
- Usage negativa/`cached>total` → `problems[]`, não normalizada.
- Replay não duplica custo/tokens/rollup (gate `emitTerminal` na 1ª transição terminal).
- Output inválido/UNKNOWN **nunca** PASSED; UNKNOWN nunca vira sucesso.
- Sem vazamento cross-tenant (filtro por `organization_id`, 404 fora do tenant).
- Prompt/segredo **jamais** persistido (só hashes/contadores/sumários; canário verifica).
- Sem billing/invoice/wallet/payment.

## Integração

`AgentStepExecutor` injeta o recorder e chama `record(...)` após `persistTrail`.
`AgentsModule` registra os 9 providers de governança + `AgentResultsController` e exporta
`RateCardCatalogProjector` + `AgentOperationalResultRecorder`. `seed.ts` roda
`runRateCardProjection` (+19 cards). Runtime (`agent-runtime.ts`) coleta `modelCalls[]`/
`toolCalls[]` por chamada e um bloco `governance` na evidência (limites + `policyHash`).

Evidência de teste: `ARDEN_BE_007_GOVERNANCE_TEST_EVIDENCE.md`.
