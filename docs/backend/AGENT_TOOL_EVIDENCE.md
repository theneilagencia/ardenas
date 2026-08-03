# Agent tool evidence (ARDEN-BE-007.5)

Por tool call: agent definition/version, run/step, turn, model call, toolCallId, alias,
actionKey, riskLevel, decision, authorizationId, approvalRequestId, inputHash, outputHash,
status, duração, evidência sanitizada do executor (só hashes), security signals. Eventos
`agent.tool_*` + `agent.execution_suspended`. NÃO grava conteúdo completo, input/output bruto,
headers, credential nem raw external body. O checkpoint só carrega contadores/hashes/metadados
sanitizados.
