# Pausa, Retomada e Cancelamento (ARDEN-BE-005 §22–§24)

Todos cooperativos e persistidos; autorização server-side; idempotentes; concorrência
por `expectedRevision` + trava de linha (`FOR UPDATE`).

## Pausa
`RUNNING|QUEUED → PAUSE_REQUESTED`. O worker conclui o checkpoint seguro e transiciona
para `PAUSED`; **nenhuma nova etapa inicia** enquanto pausado (não é só um rótulo). Uma
instrução atômica em curso pode terminar antes da pausa efetivar.

## Retomada
`PAUSED → RESUME_REQUESTED → QUEUED` + novo job. Não repete etapas concluídas (retoma no
ponto correto); mantém `attemptCount`.

## Cancelamento
`{PENDING,QUEUED,RUNNING,PAUSE_REQUESTED,PAUSED} → CANCEL_REQUESTED`. O worker verifica o
checkpoint, marca etapas pendentes `CANCELLED` e transiciona para `CANCELLED`. Uma
autorização já consumida **não** volta a `ACTIVE` automaticamente (reemissão é decisão à
parte). Jobs da execução são cancelados na fila.
