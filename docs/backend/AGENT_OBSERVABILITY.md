# Agent observability (ARDEN-BE-007.6)

Métricas + logs estruturados + endpoints de consulta. Greenfield: sem `prom-client`; o
`AgentMetrics` é um registro IN-MEMORY (counters + histogramas sum/count) que também emite
log estruturado via Pino. Sem rede, sem dependência externa.

## Métricas (`arden_agent_*`)

Emitidas uma vez por execução terminal (`recordExecution`, após a transação):
`arden_agent_executions_total`, `arden_agent_execution_duration_ms` (histograma),
`arden_agent_model_calls_total`, `arden_agent_tool_calls_total`,
`arden_agent_input_tokens_total`, `arden_agent_output_tokens_total`,
`arden_agent_estimated_cost_minor_total`, `arden_agent_approvals_total`,
`arden_agent_security_signals_total`, `arden_agent_unknown_results_total`,
`arden_agent_limit_exceeded_total`.

**Labels de BAIXA cardinalidade apenas**: `status`, `provider`, `model`, `governance`,
`evaluation`, `error_code`. Qualquer label de alta cardinalidade (org/run/user/agent/
correlation) é DESCARTADA — esses ids ficam só no log estruturado, nunca nas labels.

`snapshot()` expõe counters/histogramas para os testes.

## Endpoints administrativos (somente leitura, tenant no path)

| Método | Rota | Permissão |
| --- | --- | --- |
| GET | `/organizations/{id}/agent-execution-results` | `agent.view` |
| GET | `/organizations/{id}/agent-execution-results/{resultId}` | `agent.view` |
| GET | `/organizations/{id}/agent-usage` | `agent.cost.view` |
| GET | `/organizations/{id}/executions/{runId}/agent-usage` | `agent.view` |

Filtros de lista: `status`, `evaluationStatus`, `governanceStatus`, `agentDefinitionId`,
`agentVersionId`, `operationId`, `executionRunId`, `createdFrom/To`; paginação por cursor
(`base64url(createdAt|id)`). `agent-usage` agrega rollups por `groupBy` (dimensão). Resultado
fora do tenant → 404 `AGENT_RESULT_NOT_FOUND` (sem vazamento cross-tenant). Serialização
BigInt→number, sem conteúdo/segredo.
