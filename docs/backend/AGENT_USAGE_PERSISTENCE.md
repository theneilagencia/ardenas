# Agent usage persistence (ARDEN-BE-007.6)

Usage é agregado pelo `AgentUsageAggregator` (PURO) a partir de `outcome.modelCalls`/
`toolCalls` e persistido no `agent_execution_results` (sumário) e em linhas granulares.

## Sumário (no result)

`modelCallCount`, `toolCallCount`, `turnCount`, `repairAttemptCount`, `approvalCount`,
`securitySignalCount`, `inputTokens`, `outputTokens`, `cachedInputTokens`,
`cachedOutputTokens`, `durationMs`. Tokens são somados por chamada; `approvalCount` conta
tool calls com `authorizationId`.

## Validação (falha segura)

O agregador devolve `problems[]`. É INVÁLIDO e nunca persistido como "sucesso silencioso":

- qualquer contador de token negativo (`inputTokens < 0`, …);
- `cachedInputTokens > inputTokens` ou `cachedOutputTokens > outputTokens`.

Usage negativa/inconsistente é um FAIL da spec — não é normalizada para zero.

## Linhas granulares

- `agent_model_call_usage` — uma linha por chamada de modelo, unique `(execution_step_id,
  call_index)`. Ver `AGENT_MODEL_CALL_USAGE.md`.
- `agent_tool_call_usage` — uma linha por tool call, unique `(execution_step_id,
  tool_call_id)`. Ver `AGENT_TOOL_CALL_USAGE.md`.

Ambas são upsertadas (idempotentes) — replay não duplica. Rollups diários agregam por
dimensão em `AGENT_USAGE_ROLLUPS.md`.
