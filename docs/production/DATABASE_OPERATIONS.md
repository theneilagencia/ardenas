<!-- Milestone: ARDEN-PRD-001 -->
# ARDEN-PRD-001 — Operações de banco de dados

## Estado atual (evidência)
- **Versão:** PostgreSQL 16 (`docker-compose.yml:7` `postgres:16-alpine`; CI `postgres:16`).
- **ORM/schema:** Prisma (`apps/api/prisma/schema.prisma`); PKs UUID (`@db.Uuid`).
- **Migrations:** 11 em `apps/api/prisma/migrations/` (`migrate deploy`/`status`).
- **Ping/readiness:** `health.controller.ts:39` `prisma.ping()`.
- **Extensions/pooling explícitos:** `NOT FOUND` no schema (defaults do Prisma).

## Auditoria

| Item | Estado | Classificação |
| --- | --- | --- |
| Version pin | PG16 | READY |
| Connection pooling | não configurado explicitamente | PARTIAL (usar PgBouncer/pool gerenciado) |
| Max connections | não definido | REQUIRES EXTERNAL DECISION |
| Indexes | definidos por migration | READY (revisar por carga) |
| Locks / long transactions | queue usa SKIP LOCKED (curto) | PARTIAL (monitorar) |
| Vacuum/autovacuum | default | PARTIAL (tuning em produção) |
| Replication / failover | NOT FOUND | MISSING / P0 (instância gerenciada com HA) |
| Encryption at rest | NOT FOUND (depende do provedor) | REQUIRES EXTERNAL DECISION |
| Backups / PITR | NOT FOUND | MISSING / P0 (ver BACKUP_AND_RESTORE) |
| Monitoring | métricas in-memory apenas | MISSING / P0 |
| Maintenance windows | NOT FOUND | REQUIRES EXTERNAL DECISION |

## Recomendação
Instância **PostgreSQL gerenciada** (RDS / Cloud SQL / Neon / Supabase-managed) com HA,
PITR, pooling, encryption at rest e monitoramento nativos — evita reimplementar operação
de banco. Rede privada (banco não exposto publicamente — ver `SECURITY_OPERATIONS.md`).

---
## Atualização ARDEN-PRD-001.2A
- Análise das opções de PostgreSQL gerenciado detalhada em `MANAGED_POSTGRESQL_OPTIONS.md`
  (RDS / Cloud SQL / Azure Flexible Server / Neon / Supabase; PG16, HA, PITR, backup —
  `PARTIALLY_VERIFIED`, ver `ARDEN_PRD_001_2A_SOURCE_REGISTER.md`).
- **Pooling decidido:** `TRANSACTION_POOLING` para a app + conexão **direta** para
  migrations (`POSTGRESQL_POOLING_DECISION.md`). Requer `directUrl` no Prisma em 001.2B.
- **Backup/PITR:** política em `DATABASE_BACKUP_AND_PITR_POLICY.md`; restore drill em
  `DATABASE_RESTORE_DRILL_PLAN.md` (banco + master key + decrypt canário).
- Provedor final: `REQUIRES_BUSINESS_DECISION` (ADR-0001). Nada provisionado nesta fase.
