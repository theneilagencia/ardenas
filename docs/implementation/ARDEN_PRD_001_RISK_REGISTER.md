<!-- Milestone: ARDEN-PRD-001 -->
# ARDEN-PRD-001 — Registro de riscos

Prioridade: **P0** bloqueia qualquer produção · **P1** bloqueia piloto · **P2** antes de
escala · **P3** melhoria posterior.

| ID | Risco | Evidência | Prioridade | Mitigação | Dependência |
| --- | --- | --- | --- | --- | --- |
| R-01 | **Perda da `CONNECTOR_MASTER_KEY`** torna credenciais cifradas irrecuperáveis | `connectors/vault/connector-key-provider.ts:25` | **P0** | backup cifrado no secret manager + DR drill + keyring versionado | PRD-001.2/1.3 |
| R-02 | **Sem backup/restore comprovado** (perda de dados) | `BACKUP_AND_RESTORE.md` NOT FOUND | **P0** | banco gerenciado com PITR + restore drill trimestral | PRD-001.3 |
| R-03 | **Sem observabilidade externa** (cegueira operacional) | métricas in-memory (`agent-metrics.ts`) | **P0** | OTel + provedor + dashboards | PRD-001.4 |
| R-04 | **Sem alertas** (incidentes não detectados) | `ALERT_CATALOG.md` NOT FOUND | **P0** | catálogo de alertas + on-call | PRD-001.4 |
| R-05 | **Secrets em env-var sem secret manager** | `env.schema.ts` | **P0** | secret manager + rotação + acesso mínimo | PRD-001.2 |
| R-06 | **Banco sem HA/failover** | `DATABASE_OPERATIONS.md` | **P0** | PostgreSQL gerenciado com HA | PRD-001.3 |
| R-07 | Banco potencialmente exposto (rede) | sem rede privada definida | **P0** | banco privado + bastion/VPN | PRD-001.7 |
| R-08 | Sem staging/prod | `ENVIRONMENT_STRATEGY.md` | **P1** | provisionar ambientes | PRD-001.1 |
| R-09 | Sem deploy reproduzível/rollback | `DEPLOYMENT_AND_PROMOTION.md` | **P1** | artefato imutável + rollback | PRD-001.1 |
| R-10 | Migration sem runbook zero-downtime | `MIGRATION_RUNBOOK.md` | **P1** | expand/contract + gate | PRD-001.3 |
| R-11 | Sem incident response/runbooks | `INCIDENT_RESPONSE.md` | **P1** | severidades + runbooks + owners | PRD-001.7 |
| R-12 | Sem SLOs/baseline de performance | `SLI_SLO_FRAMEWORK.md` | **P1** | baseline + SLOs de piloto | PRD-001.4/1.6 |
| R-13 | Retenção/classificação de dados informais | `DATA_CLASSIFICATION_AND_RETENTION.md` | **P1** | política + exclusão de tenant | PRD-001.7 |
| R-14 | Privacy/compliance não revisada (LGPD/GDPR) | não auditado | **P1** | revisão legal | externa |
| R-15 | Sem container scanning/SBOM/signed artifacts | `DEPLOYMENT_AND_PROMOTION.md` | **P2** | scanning + SBOM no CI | PRD-001.1 |
| R-16 | Sem teste de carga/resiliência | `PERFORMANCE_AND_LOAD_TEST_PLAN.md` | **P2** | plano de carga | PRD-001.6 |
| R-17 | Feature flags apenas via env | runtime gates | **P2** | sistema de flags dinâmico | PRD-001.1 |
| R-18 | Segredo em JS best-effort (herdado BE-008) | `ARDEN_BE_008_SECURITY_AUDIT.md` | **P3** | documentado; mitigação limitada pela plataforma | — |
| R-19 | Anthropic não verificado ao vivo (herdado) | `ANTHROPIC_PRODUCTION_DEFERRED_GATES.md` | **P3** (bloqueado) | manter bloqueio até gates | fora do PRD-001 |

Riscos R-18/R-19 são herdados e permanecem **fora** do escopo de resolução deste milestone
(apenas registrados; produção Anthropic segue bloqueada).

---
## Atualização ARDEN-PRD-001.1
- **R-01** (perda master key): PARTIALLY_CLOSED (keyring versionado + backup cifrado + restore
  verify + drill offline PASS; infra real STILL_OPEN).
- **R-05** (secrets sem manager): PARTIALLY_CLOSED (fronteira + fail-closed de produção; adapter
  externo BLOCKED_BY_EXTERNAL_DECISION).
- Demais riscos: STILL_OPEN.
