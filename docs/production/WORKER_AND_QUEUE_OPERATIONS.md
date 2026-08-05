<!-- Milestone: ARDEN-PRD-001 -->
# ARDEN-PRD-001 — Worker e fila

## Estado atual (evidência)
Fila própria em PostgreSQL (`apps/api/src/executions/execution.queue.ts`):
- Aquisição atômica `FOR UPDATE SKIP LOCKED` (`:44`–`:56`) — dois workers nunca pegam o
  mesmo job.
- Lease renovável via `heartbeat` (`:66`–`:70`); jobs órfãos (lease expirado) reprocessáveis.
- `complete` (`:77`) e `release` com `retry`/`FAILED` (`:81`–`:89`).
- Worker: `apps/api/src/executions/execution.worker.ts`, `apps/api/src/worker.ts`
  (processo separado; graceful shutdown referenciado).

Classificação do código: **READY**. Falta: **runbooks operacionais + métricas/alertas de fila**.

## Auditoria

| Item | Estado | Classificação |
| --- | --- | --- |
| Queue (PG table) | implementada | READY |
| SKIP LOCKED | sim | READY |
| Lease / expiration | sim (heartbeat + órfãos) | READY |
| Retries | sim (`RETRY_WAIT`/`FAILED`) | READY |
| Dead-letter | via `FAILED` | PARTIAL (política/inspeção explícita) |
| Stuck jobs | recuperáveis por lease expirado | PARTIAL (runbook + alerta) |
| Concurrency | por worker | PARTIAL (definir por ambiente) |
| Graceful shutdown | referenciado | PARTIAL (validar drain de lease no SIGTERM) |
| Scaling | processo separado | PARTIAL (autoscaling por profundidade de fila) |
| Duplicate processing | prevenido (SKIP LOCKED + idempotência) | READY |
| Monitoring | in-memory | MISSING (externalizar) |
| Manual recovery | não documentado | MISSING (runbooks abaixo) |

## Runbooks (propostos)
- **Job preso:** identificar lease expirado; confirmar worker vivo; reprocessar ou marcar
  `FAILED`; investigar causa.
- **Lease expirado em massa:** verificar saturação/deploy do worker; escalar réplicas.
- **Retry storm:** inspecionar `lastError`; pausar origem; ajustar backoff; DLQ manual.
- **Worker down:** health/alerta; subir réplica; drenar fila.
- **Queue crescendo:** alertar por `oldest job age`; escalar; verificar dependência lenta.
- **Poison job:** mover para `FAILED`/DLQ; não bloquear a fila.
- **Resultado externo UNKNOWN:** não repetir cegamente efeitos externos; seguir política
  UNKNOWN (sem sucesso falso) — ver runtime BE-008.5.
