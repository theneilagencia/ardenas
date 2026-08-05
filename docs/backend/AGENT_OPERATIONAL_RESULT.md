# Agent operational result (ARDEN-BE-007.6)

Todo `agent.execute` terminal produz UM registro operacional persistido e consultável:
`agent_execution_results` (unique por `execution_step_id`). É o ponto único que agrega
avaliação, usage, custo e governança de uma etapa de agente.

`AgentOperationalResultRecorder.record(...)` (chamado pelo `AgentStepExecutor` após
`persistTrail`) lê o `AgentRuntimeOutcome` (`evidence`, `result`, `modelCalls`, `toolCalls`)
e, numa única transação:

1. **Usage** — `AgentUsageAggregator` soma tokens/contadores (ver `AGENT_USAGE_PERSISTENCE.md`).
2. **Custo** — `AgentCostEstimator` sobre a rate card ativa (ver `AGENT_COST_ESTIMATION.md`).
3. **Avaliação** — `AgentEvaluationEngine` determinístico (ver `AGENT_DETERMINISTIC_EVALUATION.md`).
4. **Governança** — `AgentGovernanceEvaluator` (ver `AGENT_GOVERNANCE_ENFORCEMENT.md`).
5. **Persistência** — upsert do result + `agent_model_call_usage` + `agent_tool_call_usage`;
   incrementa os rollups (ver `AGENT_USAGE_ROLLUPS.md`) **uma vez** por transição terminal.
6. **Trilha** — audit `agent.result_recorded`, evidência `DECISION`, eventos de
   `cost_rate_card_missing`/`limit_exceeded`/`limit_warning`, métricas `arden_agent_*`.

## Campos (sanitizados)

`status`, `outputValidationStatus`, `evaluationStatus`, `governanceStatus`, contadores de
usage, `estimatedCostMinor` (BigInt) / `currency` / `rateCardId`, `outputHash`/`contextHash`,
`evaluationSummary`/`governanceSummary`/`evidenceReferenceIds` (JSON), `startedAt`/
`completedAt`/`durationMs`. **Nunca** prompt, output bruto, contexto ou segredo — apenas
hashes, contadores e sumários.

## Idempotência

`revision` incrementa a cada `record`; rollups, auditoria terminal e métricas só disparam na
PRIMEIRA transição para terminal (`SUCCEEDED`/`FAILED`/`UNKNOWN`). Replay do worker atualiza o
result mas não duplica rollup/custo/token/métrica. Ver `AGENT_USAGE_ROLLUPS.md`.

Consultas administrativas: `AGENT_OBSERVABILITY.md` §endpoints. Relatório:
`ARDEN_BE_007_GOVERNANCE_REPORT.md`.
