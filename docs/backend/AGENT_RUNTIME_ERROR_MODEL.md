# Modelo de erros do runtime (ARDEN-BE-007.3 §22)

O runtime classifica o resultado do provider em códigos tipados e mapeia o `AgentExecutionStatus`
para return/throw no `StepExecutor` (SUCCEEDED → return; demais → throw, não-retryable salvo
transientes).

| Situação | errorCode | status agente | step | retryable |
| --- | --- | --- | --- | --- |
| output válido | — | SUCCEEDED | SUCCEEDED | — |
| output inválido (sem repair) | `AGENT_OUTPUT_INVALID` | FAILED | FAILED | não |
| repair esgotado | `AGENT_OUTPUT_REPAIR_EXHAUSTED` | FAILED | FAILED | não |
| input inválido | `AGENT_INPUT_INVALID` | FAILED | FAILED | não |
| contexto/tokens excedidos | `AGENT_CONTEXT_TOO_LARGE` / `AGENT_TOKEN_LIMIT_EXCEEDED` | FAILED | FAILED | não |
| tool calling pedido | `AGENT_TOOL_NOT_ALLOWED` | FAILED | FAILED | não |
| injeção bloqueada | `AGENT_PROMPT_INJECTION_DETECTED` | FAILED | FAILED | não |
| avaliação reprovou | `AGENT_EVALUATION_FAILED` | FAILED | FAILED | não |
| content filter | `MODEL_CONTENT_FILTERED` | FAILED | FAILED | não |
| rate limit | `MODEL_RATE_LIMITED` | FAILED | FAILED | sim |
| provider error | `MODEL_PROVIDER_ERROR` | FAILED | FAILED | sim |
| timeout | `AGENT_TIMEOUT` | FAILED/SUSPENDED (policy) | FAILED | sim |
| resultado incerto | `MODEL_RESULT_UNKNOWN` | UNKNOWN/SUSPENDED (policy) | FAILED | **não** |
| provider proibido em produção / resolução | `MODEL_PROVIDER_DISABLED` etc. | FAILED | FAILED | não |

`MODEL_RESULT_UNKNOWN` respeita `unknownResultBehavior` e **nunca** vira SUCCEEDED nem é
retryado automaticamente. Invariantes de resultado forçam consistência (SUCCEEDED exige output).
