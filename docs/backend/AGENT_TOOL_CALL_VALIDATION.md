# Agent tool call validation (ARDEN-BE-007.5)

`AgentToolCallValidator` (PURO) NÃO confia no provider. Valida: id presente/limitado; alias
allowlistado e resolvido; tetos total e por alias; input serializável (rejeita BigInt/
symbol/função/Buffer/circular); tamanho ≤ 32 KiB; schema da ferramenta; e REJEITA
propriedades de controle (organizationId, tenant, connectionId, credential, authorization,
endpoint, host, headers, networkPolicy, idempotencyMode, retryMode, timeoutMs, executor) e
URL absoluta. Erros: `AGENT_TOOL_CALL_INVALID`, `AGENT_TOOL_NOT_ALLOWED`,
`AGENT_TOOL_CALL_LIMIT_EXCEEDED`.
