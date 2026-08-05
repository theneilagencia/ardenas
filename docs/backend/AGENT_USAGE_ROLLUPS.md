# Agent usage rollups (ARDEN-BE-007.6)

`agent_usage_rollups`: agregados diários (UTC) por dimensão, para consultas administrativas
de consumo sem varrer os results linha a linha.

## Chave (unique 7-tupla)

`(organization_id, dimension_type, dimension_id, period_date, provider_key, model_id,
currency)`. `period_date` é o dia UTC (`Date.UTC(y, m, d)`).

## Dimensões (8 buckets por execução terminal)

`ORGANIZATION`, `OPERATION`, `OPERATION_VERSION`, `AGENT_DEFINITION`, `AGENT_VERSION`,
`MODEL_CONFIGURATION`, `PROVIDER`, `MODEL`. Uma execução incrementa exatamente um bucket por
dimensão (8 upserts).

## Contadores

`executionCount`, `succeededCount`, `failedCount`, `suspendedCount`, `unknownCount`,
`modelCallCount`, `toolCallCount`, `approvalCount`, `criticalSignalCount`, `inputTokens`,
`outputTokens`, `estimatedCostMinor` (BigInt), `durationMs` (BigInt).

## Idempotência (crítica)

O incremento só ocorre na PRIMEIRA transição da etapa para terminal (`emitTerminal =
TERMINAL(status) && !wasTerminal`). Replay do worker sobre uma etapa já terminal atualiza o
result mas NÃO reincrementa rollup, custo ou tokens (FAIL da spec: replay duplicando custo/
tokens/rollups). Quando não há currency de custo, o bucket usa `XXX` como placeholder.

Consulta: `GET /organizations/{id}/agent-usage?groupBy=<dimension>` (ver
`AGENT_OBSERVABILITY.md`).
