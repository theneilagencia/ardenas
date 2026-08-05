<!-- Milestone: ARDEN-SCOPE-001 -->
# ARDEN-SCOPE-001 — Cobertura operacional e de produção

Scores: **Operacional 19,2%** · **Produção 0%**. `PREPARED` ≠ `IMPLEMENTED`.

| Item | Estado |
| --- | --- |
| IaC neutro | PREPARED (`infra/`, validadores offline) |
| IaC específico de provedor | BLOCKED_BY_DECISION |
| staging | BLOCKED_BY_DECISION |
| production | BLOCKED_BY_DECISION |
| PostgreSQL gerenciado | BLOCKED_BY_DECISION (documentado) |
| HA | BLOCKED_BY_DECISION |
| pooling | PREPARED (DIRECT_URL implementado; pooler real 001.2B) |
| backup | BLOCKED_BY_DECISION |
| PITR | BLOCKED_BY_DECISION |
| restore drill real | PREPARED (plano + adapter fail-closed + drill offline de chave) |
| secret manager externo | BLOCKED_BY_DECISION (fronteira pronta) |
| private networking | PREPARED (documentado + catálogo validado) |
| WAF | DOCUMENTED_ONLY |
| egress | PREPARED (default DENY; Anthropic bloqueado) |
| observabilidade externa | PREPARED (contrato; backend não selecionado) |
| alertas | PREPARED (19 definições machine-readable) |
| deploy | PREPARED (artifact por SHA + deploy fail-closed) |
| rollback | PREPARED |
| on-call | DOCUMENTED_ONLY |
| incident response | DOCUMENTED_ONLY (runbooks) |

Produção **BLOCKED_BY_DECISION**: ADR-0001 `PROPOSED`, `ARDEN_PRD_001_2B_ENTRY_GATE = FAIL`.
Ver `docs/production/GO_LIVE_GATES.md` e `INFRASTRUCTURE_IMPLEMENTATION_PLAN.md`.
