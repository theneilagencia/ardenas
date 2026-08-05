# Máquina de Estados de Execução (ARDEN-BE-005 §10)

Serviço explícito e PURO (`execution.state-machine.ts`). Nenhuma transição é aceita
só porque um status novo foi enviado; não existe PATCH genérico de status.

## Transições permitidas

```
PENDING          → QUEUED, CANCEL_REQUESTED, FAILED
QUEUED           → RUNNING, PAUSE_REQUESTED, CANCEL_REQUESTED
RUNNING          → SUCCEEDED, FAILED, TIMED_OUT, PAUSE_REQUESTED, CANCEL_REQUESTED
PAUSE_REQUESTED  → PAUSED, CANCEL_REQUESTED
PAUSED           → RESUME_REQUESTED, CANCEL_REQUESTED
RESUME_REQUESTED → QUEUED, CANCEL_REQUESTED
CANCEL_REQUESTED → CANCELLED
FAILED           → QUEUED (retry), COMPENSATING
TIMED_OUT        → QUEUED (retry), COMPENSATING
COMPENSATING     → COMPENSATED, COMPENSATION_FAILED
```

Terminais (sem saída): `CANCELLED`, `SUCCEEDED`, `COMPENSATED`, `COMPENSATION_FAILED`.

Toda transição grava um evento `execution.<status>` append-only e é guardada por
`WHERE status = <origem>` (compare-and-set), evitando corrida.
