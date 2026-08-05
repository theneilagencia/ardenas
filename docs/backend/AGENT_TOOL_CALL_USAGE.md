# Agent tool call usage (ARDEN-BE-007.6)

`agent_tool_call_usage`: uma linha por tool call proposto pelo modelo e processado pelo
servidor. Upsert idempotente por `(execution_step_id, tool_call_id)`.

## Colunas

Dimensões: `organization_id`, `execution_run_id`, `execution_step_id`,
`agent_definition_id`, `agent_version_id`.

Chamada: `tool_call_id`, `alias`, `action_key`, `risk_level`
(`READ`/`WRITE`/`ADMIN`/`UNKNOWN`), `decision` (`ALLOW`/`REQUIRE_APPROVAL`/`DENY`),
`status`, `authorization_id`, `approval_request_id`.

Execução: `input_hash`, `output_hash`, `duration_ms`, `retry_count`, `completed_at`.

## Origem (007.5)

Os campos vêm do `AgentToolCallRecord` produzido pelo loop de tool calling
(`AGENT_TOOL_CALLING_RUNTIME.md`): risco resolvido do binding, decisão de autoridade
(`AGENT_TOOL_AUTHORITY.md`), `ActionAuthorization` consumida e `ApprovalRequest` quando houve
suspensão. Nunca input/output bruto ou credencial — apenas hashes e identificadores.

`approval_count` do result = número de tool calls com `authorization_id`. Tool calls não
contam custo de tokens (isso é do modelo); custo da tool em si não é estimado nesta fase.
