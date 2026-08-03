# Agent operational alerts (ARDEN-BE-007.6)

Alertas operacionais são EVENTOS de execução (`execution_events`) e métricas — não notificação
externa (e-mail/webhook fica para outra fase). Emitidos pelo recorder na primeira transição
terminal, dentro da transação, com payload sanitizado.

## Eventos

| Evento | Disparo | Payload |
| --- | --- | --- |
| `agent.result_recorded` (audit) | todo result registrado | status, evaluationStatus, governanceStatus, costWarning |
| `agent.cost_rate_card_missing` | rate card ausente (custo `null`) | providerKey, modelId |
| `agent.limit_exceeded` | governança `LIMIT_EXCEEDED`/`BLOCKED` | status, reasonCode |
| `agent.limit_warning` | governança `LIMIT_WARNING` (≥80%) | reasonCode |

## Métricas correlatas

`arden_agent_limit_exceeded_total`, `arden_agent_unknown_results_total`,
`arden_agent_security_signals_total` — permitem alertar por taxa/volume sem ler payloads.
Ver `AGENT_OBSERVABILITY.md`.

## Falha segura

Um `agent.limit_exceeded` acompanha um `governanceStatus` persistido; o comportamento de
execução (falhar/suspender/exigir aprovação) é decidido pelo `actionOnLimit` da política no
runtime — o alerta REGISTRA, não é o mecanismo de enforcement. Alertas nunca contêm prompt,
output ou segredo — apenas códigos e contadores.
