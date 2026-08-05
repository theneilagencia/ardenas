# Modelo do Worker (ARDEN-BE-005 §17/§18)

Processo LÓGICO separado do API (`apps/api/src/worker.ts`). Sobe um contexto Nest
sem servidor HTTP e roda o loop do `ExecutionWorker`.

## Loop

1. Recupera leases expirados (`recoverExpiredLeases`).
2. Adquire o próximo job (`FOR UPDATE SKIP LOCKED`) com um `workerId` e um lease.
3. Processa a execução (`ExecutionProcessor.process`): `QUEUED→RUNNING`, etapas em
   ordem, checkpoints de pause/cancel/timeout, retries com backoff.
4. Renova o lease (`heartbeat`) a cada etapa.
5. Conclui/relibera o job.

## Garantias

- Dois workers nunca processam o mesmo job (SKIP LOCKED + lease).
- Worker morto → lease expira → job volta a `QUEUED` → outro worker retoma
  (`EXECUTION_JOB_RECOVERY.md`).
- Estado crítico vive no banco, nunca em memória local.

Config por env: `WORKER_ID`, `WORKER_LEASE_SECONDS` (30), `WORKER_POLL_INTERVAL_MS`
(1000). `ExecutionWorker.drain()` existe para testes determinísticos.
