<!-- Milestone: ARDEN-PRD-001 -->
# ARDEN-PRD-001 — Catálogo de alertas

Estado atual: **NOT FOUND** (sem alerting). Classificação: **MISSING / P0**. Catálogo
mínimo proposto (owner e runbook a atribuir na implementação).

## Métricas obrigatórias (fonte dos alertas)
- **API:** request rate, latency (p50/p95/p99), error rate, saturation, auth failures,
  4xx/5xx, DB latency, connection pool.
- **Worker:** queue depth, oldest job age, lease failures, jobs processed, retries,
  failures, UNKNOWN, stuck jobs.
- **Agents:** executions, model calls, tool calls, approvals, evaluation failures,
  governance blocks, usage, unknown cost.
- **Connectors:** external calls, latency, error rate, rate limits, circuit breakers,
  webhook failures.

## Catálogo

| Alert | Condition | Severity | Owner | Runbook |
| --- | --- | --- | --- | --- |
| API unavailable | uptime check falha | SEV-1 | plataforma | INCIDENT_RESPONSE |
| High 5xx rate | 5xx > limiar por N min | SEV-2 | plataforma | INCIDENT_RESPONSE |
| High latency | p95 > SLO | SEV-2 | plataforma | INCIDENT_RESPONSE |
| Database unavailable | `/readyz` 503 / ping falha | SEV-1 | plataforma | INCIDENT_RESPONSE |
| DB storage threshold | uso > 80% | SEV-2 | plataforma | DATABASE_OPERATIONS |
| Worker unavailable | sem heartbeat | SEV-1 | plataforma | WORKER_AND_QUEUE_OPERATIONS |
| Queue age threshold | oldest job age > limiar | SEV-2 | plataforma | WORKER_AND_QUEUE_OPERATIONS |
| Retry storm | taxa de retry > limiar | SEV-2 | plataforma | WORKER_AND_QUEUE_OPERATIONS |
| Job stuck | lease expirado sem progresso | SEV-3 | plataforma | WORKER_AND_QUEUE_OPERATIONS |
| Migration failure | gate de migration falha | SEV-1 | release | MIGRATION_RUNBOOK |
| Backup failure | job de backup falha | SEV-1 | plataforma | BACKUP_AND_RESTORE |
| Restore verification failure | drill falha | SEV-1 | plataforma | DISASTER_RECOVERY |
| Secret decryption failure | vault falha ao decifrar | SEV-1 | segurança | INCIDENT_RESPONSE |
| Connector master key error | chave indisponível/inválida | SEV-1 | segurança | DISASTER_RECOVERY |
| Auth anomaly | pico de falhas de auth | SEV-2 | segurança | SECURITY_OPERATIONS |
| Cross-tenant security signal | acesso cruzado detectado | SEV-1 | segurança | INCIDENT_RESPONSE |
| Unexpected cost spike | custo/uso acima do baseline | SEV-2 | produto | INCIDENT_RESPONSE |
| Disk/memory saturation | recurso > limiar | SEV-2 | plataforma | INCIDENT_RESPONSE |
| Certificate expiration | validade < 14 dias | SEV-3 | plataforma | SECURITY_OPERATIONS |

Severidades definidas em `INCIDENT_RESPONSE.md`.
