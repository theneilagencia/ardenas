# Agent deterministic evaluation (ARDEN-BE-007.6)

`AgentEvaluationEngine.evaluate(...)` é PURO e determinístico — a decisão FINAL de PASSED/
FAILED NUNCA depende de LLM-as-judge. Um avaliador de modelo pode existir como sinal, mas o
critério final é o conjunto de checks abaixo.

## Checks

| Check | Severidade | FAILED quando |
| --- | --- | --- |
| `output.schema_valid` | blocking | output final não valida contra o `outputSchema` |
| `output.completion_criteria` | blocking | avaliação de completude do output não passou |
| `execution.no_unknown_results` | blocking | houve resultado UNKNOWN (modelo/tool) |
| `execution.no_denied_required_action` | warning | tool call obrigatória foi DENY |
| `within_turn_limit` | blocking | turnos > `maxTurns` |
| `within_tool_limit` | blocking | tool calls > `maxToolCalls` |
| `within_duration_limit` | blocking | duração > `maxDurationMs` |
| `required_evidence_present` | blocking | `requireEvidenceReferences` e nenhuma evidência |
| `security.no_critical_signal` | critical | sinal de segurança CRÍTICO/injeção |
| `security.no_untrusted_signal` | warning | sinal não crítico de conteúdo não confiável |
| `approval.required_actions_approved` | blocking | ação exigindo aprovação sem aprovação |

## Status resultante

- `NOT_RUN` — a execução não chegou à fase de avaliação (ex.: erro de provider/resolução).
- `PASSED` — todos os checks blocking/critical passam e não há warning.
- `PARTIAL` — checks blocking/critical passam, mas há ao menos um WARNING.
- `FAILED` — qualquer check blocking ou critical falha.

Regra dura: output inválido/UNKNOWN **nunca** vira PASSED. Cada check vira uma linha em
`evaluationSummary.checks` (label, severidade, passou, detalhe curto) — sem conteúdo bruto.
Ver `AGENT_EVALUATION_MODEL.md` (design) e `AGENT_OPERATIONAL_RESULT.md`.
