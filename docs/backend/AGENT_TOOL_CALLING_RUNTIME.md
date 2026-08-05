# Agent tool calling runtime (ARDEN-BE-007.5)

O loop do agente (`AgentRuntimeService`) executa turnos: o provider propõe `ModelToolCall`
(finishReason `TOOL_CALL`); o servidor valida → resolve binding → avalia autoridade →
executa (ALLOW) / suspende (REQUIRE_APPROVAL) / nega (DENY); reinsere o resultado ISOLADO e
chama o modelo de novo até o `structured output` final. O modelo apenas propõe; o servidor
decide e executa. Sem execução paralela, sem tool dinâmica, sem endpoint direto. Limites:
`maximumTurns` (rodadas de tool), `maximumToolCalls`, `maximumCallsPerAlias`, orçamento de
contexto/tokens. Ver `ARDEN_BE_007_TOOL_CALLING_REPORT.md`.

## Nota 008.5 — provider Anthropic participa provider-neutro

O provider Anthropic (Fatia 2, ARDEN-BE-008.5) passa a propor `ModelToolCall` e a consumir
`AgentToolCallResult` reutilizando **este runtime sem alteração**: nenhum `if provider ===
'anthropic'`, nenhuma nova migração/endpoint. O provider só **traduz** na borda (definições,
`tool_use`, `tool_result`, continuação) e **nunca** valida, resolve binding, avalia autoridade,
cria aprovação, emite `ActionAuthorization` ou executa tool — tudo isso segue aqui. Tool calling
implementation: **OFFLINE VERIFIED**; Live Anthropic tool calling: **NOT EXECUTED**; Production:
**BLOCKED**. Ver `ANTHROPIC_TOOL_CALLING_RUNTIME.md`.
