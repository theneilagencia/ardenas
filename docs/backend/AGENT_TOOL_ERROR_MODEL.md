# Agent tool error model (ARDEN-BE-007.5)

| Código | Quando |
| --- | --- |
| `AGENT_TOOL_CALL_INVALID` | id/schema/tamanho/prop de controle/URL/tipos inválidos. |
| `AGENT_TOOL_NOT_ALLOWED` | alias não allowlistado ou indisponível (binding/conexão/tool). |
| `AGENT_TOOL_CALL_LIMIT_EXCEEDED` | teto total ou por alias atingido. |
| `AGENT_TURN_LIMIT_EXCEEDED` | teto de rodadas de tool. |
| `AGENT_TOOL_REQUIRES_APPROVAL` | suspensão para aprovação humana. |
| `MODEL_RESULT_UNKNOWN` | resultado de tool incerto (nunca vira sucesso). |
| `TOOL_OUTPUT_INVALID` | saída externa não valida contra o outputSchema (BE-006). |

DENY vira resultado `DENIED` tipado ao modelo (sem detalhe de política). Reutiliza os
códigos do BE-004/006 (`ACTION_DENIED`, `AUTHORIZATION_*`, `TOOL_EXECUTION_DENIED`,
`EXTERNAL_RESULT_UNKNOWN`).
