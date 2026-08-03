# Agent tool calling runtime (ARDEN-BE-007.5)

O loop do agente (`AgentRuntimeService`) executa turnos: o provider propõe `ModelToolCall`
(finishReason `TOOL_CALL`); o servidor valida → resolve binding → avalia autoridade →
executa (ALLOW) / suspende (REQUIRE_APPROVAL) / nega (DENY); reinsere o resultado ISOLADO e
chama o modelo de novo até o `structured output` final. O modelo apenas propõe; o servidor
decide e executa. Sem execução paralela, sem tool dinâmica, sem endpoint direto. Limites:
`maximumTurns` (rodadas de tool), `maximumToolCalls`, `maximumCallsPerAlias`, orçamento de
contexto/tokens. Ver `ARDEN_BE_007_TOOL_CALLING_REPORT.md`.
