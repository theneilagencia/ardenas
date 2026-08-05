<!-- Milestone: ARDEN-SCOPE-001 -->
# ARDEN-SCOPE-001 — Cobertura do motor de execução

Score: **86,7%** (backend COMPLETE; UI de execuções MOCK_ONLY).

| Capacidade | Evidência | Status |
| --- | --- | --- |
| Fila durável PostgreSQL | `execution.queue.ts:48` `UPDATE … FOR UPDATE SKIP LOCKED LIMIT 1` | COMPLETE |
| Leases renováveis + heartbeat | `execution.queue.ts:67` heartbeat; processor `:99` | COMPLETE |
| Recuperação de job preso | `execution.queue.ts:117` recoverExpiredLeases; eventos lease_expired/recovered | COMPLETE |
| Retry com backoff | processor `:162` + retry-policy | COMPLETE |
| Pausa/retomada + checkpoint | processor checa PAUSE_REQUESTED; suspensão cooperativa | COMPLETE |
| Compensação em ordem reversa | processor `:190-222` | COMPLETE |
| Worker entrypoint real | `worker.ts` (`start:worker`); fail-closed sem keyring | COMPLETE |
| Evidence por execução | EvidenceRecord; endpoints de leitura | COMPLETE |
| Testes críticos | §40 duplo-consumo→1 execução; §41 worker morto→recuperado sem repetir etapa; §42 pausa real | COMPLETE |
| UI de execuções | `/executions` lê snapshot; backend não conectado | MOCK_ONLY (GAP-003) |
