# Agent tool resume (ARDEN-BE-007.5)

Suspensão cooperativa: a etapa de agente vira `PAUSED` e o run `PAUSED` (o job é liberado).
Na retomada (`/executions/{id}/resume` → run re-enfileirado), o processor reseta etapas
`PAUSED`→`PENDING` e reprocessa. O loop determinístico é refeito: tool calls já concluídas
são replayadas do checkpoint (sem reexecutar); a tool aprovada encontra a `ActionAuthorization`
ATIVA, consome (single-use) e executa UMA vez. Concorrência contida por lease do job
(FOR UPDATE SKIP LOCKED) + consumo single-use. Model calls determinísticos podem ser
refeitos sem efeito externo.
