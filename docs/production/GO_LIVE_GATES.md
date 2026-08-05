<!-- Milestone: ARDEN-PRD-001 -->
# ARDEN-PRD-001 — Go-live gates

Checklist bloqueante. Classificação de cada gate: **BLOCKING** (qualquer produção),
**REQUIRED BEFORE PILOT**, **REQUIRED BEFORE COMMERCIAL PRODUCTION**, **POST-LAUNCH**.

| Gate | Estado atual | Classificação |
| --- | --- | --- |
| Environments ready (staging+prod) | MISSING | REQUIRED BEFORE PILOT |
| Deploy reproducible (artefato imutável) | MISSING | REQUIRED BEFORE PILOT |
| Secrets managed (secret manager) | MISSING | BLOCKING |
| Database managed (HA) | MISSING | REQUIRED BEFORE PILOT |
| Backups enabled | MISSING | BLOCKING |
| Restore drill passed | UNVERIFIED | BLOCKING |
| Observability external | MISSING | REQUIRED BEFORE PILOT |
| Alerts active | MISSING | REQUIRED BEFORE PILOT |
| Runbooks approved | MISSING | REQUIRED BEFORE PILOT |
| Incident owners assigned | MISSING | REQUIRED BEFORE PILOT |
| Load test passed | MISSING | REQUIRED BEFORE COMMERCIAL PRODUCTION |
| Security review passed | PARTIAL | REQUIRED BEFORE COMMERCIAL PRODUCTION |
| Tenant isolation regression passed | READY (cross-tenant 404 testado) | REQUIRED BEFORE PILOT |
| Migrations rehearsed | PARTIAL | REQUIRED BEFORE PILOT |
| Rollback rehearsed | MISSING | REQUIRED BEFORE PILOT |
| Pilot passed | MISSING | REQUIRED BEFORE COMMERCIAL PRODUCTION |
| Legal/privacy review | MISSING | REQUIRED BEFORE COMMERCIAL PRODUCTION |
| Support model defined | MISSING | REQUIRED BEFORE PILOT |
| **Anthropic production block mantido** | READY (DISABLED) | BLOCKING (deve permanecer) |

## Regra
Nenhuma produção comercial sem todos os `BLOCKING` + `REQUIRED BEFORE COMMERCIAL
PRODUCTION`. Nenhum piloto sem os `REQUIRED BEFORE PILOT` + `BLOCKING`. Anthropic
permanece bloqueado independentemente destes gates (gates próprios em
`ANTHROPIC_PRODUCTION_DEFERRED_GATES.md`).

---
## Atualização ARDEN-PRD-001.1D
- **Secrets managed:** PARTIALLY_CLOSED — fronteira + fail-closed + keyring versionado +
  recriptografia + preflight readiness entregues; **secret manager de produção**
  BLOCKED_BY_EXTERNAL_DECISION.
- **Backups enabled / Restore drill:** keyring: PARTIALLY_CLOSED (backup cifrado + restore
  verify + drill offline); **DATABASE** backup/PITR/restore: STILL_OPEN / UNVERIFIED (PRD-001.2).
- Demais gates: inalterados.

---
## Atualização ARDEN-PRD-001.2A (decisão de infraestrutura — documental)
- **Decisão registrada:** `INFRASTRUCTURE_DECISION: REQUIRES_BUSINESS_DECISION`
  (`docs/decisions/ADR-0001-PRODUCTION-INFRASTRUCTURE.md`, status PROPOSED). Finalistas:
  B (GCP), D (PaaS), A (AWS). Ver `ARDEN_PRD_001_2A_DECISION_REPORT.md`.
- Nenhum gate mudou de estado (fase documental). O que 001.2A **destrava** ao ser decidido:
  - *Database managed (HA)* / *Backups enabled* / *Restore drill*: políticas e plano de
    drill definidos (`DATABASE_BACKUP_AND_PITR_POLICY.md`, `DATABASE_RESTORE_DRILL_PLAN.md`)
    — habilitação em 001.2B.
  - *Secrets managed*: opções + adapter neutro (`SECRET_MANAGER_OPTIONS.md`) — implementação
    em 001.2B.
  - *Rede privada + egress deny*: decisão em `NETWORK_AND_EGRESS_DECISION.md` — aplicação
    em 001.2B.
- **Bloqueio:** gates BLOCKING permanecem MISSING/UNVERIFIED até 001.2B; 001.2B só inicia
  após decisão de negócio (custo S5 + SLA S4 + jurídico S8) e ADR-0001 → ACCEPTED.
- **Anthropic:** permanece DISABLED.
