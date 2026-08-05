# Agent model call usage (ARDEN-BE-007.6)

`agent_model_call_usage`: uma linha por chamada ao provider de modelo dentro de uma etapa de
agente. Append/upsert idempotente por `(execution_step_id, call_index)`.

## Colunas

Dimensões: `organization_id`, `execution_run_id`, `execution_step_id`, `agent_definition_id`,
`agent_version_id`, `model_configuration_id`, `provider_key`, `provider_version`, `model_id`.

Chamada: `call_index`, `purpose` (`PRIMARY` | `OUTPUT_REPAIR` | `TOOL_CONTINUATION`),
`status`, `finish_reason`.

Usage: `input_tokens`, `output_tokens`, `cached_input_tokens`, `cached_output_tokens`,
`duration_ms`.

Custo: `estimated_cost_minor` (BigInt, unidade menor), `currency`, `rate_card_id` — custo
POR chamada via `AgentCostEstimator` (rate card ausente → `null`, nunca zero inventado).

Hashes: `request_hash`, `response_hash` — nunca prompt/resposta bruta ou segredo.

## `purpose`

Classifica o motivo da chamada dentro do loop multi-turno:

- `PRIMARY` — chamada inicial de cada turno;
- `OUTPUT_REPAIR` — reparo de structured output inválido (ver `AGENT_OUTPUT_REPAIR.md`);
- `TOOL_CONTINUATION` — chamada após reinserir o resultado isolado de uma tool.

A soma dos `estimated_cost_minor` das chamadas é o custo do result. Ver
`AGENT_COST_ESTIMATION.md`.
