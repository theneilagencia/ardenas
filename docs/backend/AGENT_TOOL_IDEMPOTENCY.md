# Agent tool idempotency (ARDEN-BE-007.5)

Chave lógica estável por tool call: `executionStepId:toolCallId:normalizedInputHash`. O
checkpoint (`agent_runtime_checkpoints`) guarda as tool calls concluídas por chave; no
replay a mesma chave devolve o resultado persistido (sem reexecutar). A `ActionAuthorization`
single-use garante um único efeito externo para a tool aprovada. Restart de worker e
retomada de aprovação não duplicam efeito. Reutiliza a infraestrutura existente (idempotency
de request do BE-006 + lease do job do BE-005); não cria idempotência paralela.
