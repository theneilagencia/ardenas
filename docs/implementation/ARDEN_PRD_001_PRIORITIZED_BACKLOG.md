<!-- Milestone: ARDEN-PRD-001 -->
# ARDEN-PRD-001 — Backlog priorizado

Prioridade: **P0** bloqueia qualquer produção · **P1** bloqueia piloto · **P2** antes de
escala · **P3** posterior. Cada item: descrição · evidência · risco · dependências · fase ·
critério de aceite.

## P0 — bloqueiam qualquer produção
1. **Secret manager + injeção em runtime.** Ev.: `env.schema.ts` (env-var). Risco: R-05.
   Dep.: provedor. Fase: 1.2. Aceite: secrets fora do repo, rotação e acesso mínimo ativos.
2. **Backup do `CONNECTOR_MASTER_KEY` + keyring versionado + DR de chave.** Ev.:
   `connector-key-provider.ts:25`. Risco: R-01. Dep.: secret manager. Fase: 1.2/1.3.
   Aceite: restore da chave testado; decrypt de credencial verificado.
3. **Banco gerenciado com HA + PITR.** Ev.: `DATABASE_OPERATIONS.md`. Risco: R-06. Dep.:
   provedor. Fase: 1.3. Aceite: failover e PITR habilitados.
4. **Backup automatizado + restore drill PASS.** Ev.: `BACKUP_AND_RESTORE.md` NOT FOUND.
   Risco: R-02. Fase: 1.3. Aceite: drill completo documentado (banco+chave+decrypt).
5. **Observabilidade externa (logs+metrics+traces).** Ev.: `agent-metrics.ts` (in-memory).
   Risco: R-03. Fase: 1.4. Aceite: dashboards + retenção externos.
6. **Alertas críticos ativos (SEV-1/2).** Ev.: `ALERT_CATALOG.md` NOT FOUND. Risco: R-04.
   Fase: 1.4. Aceite: alertas com owner e runbook disparando.
7. **Rede privada de banco + egress deny (Anthropic).** Ev.: `SECURITY_OPERATIONS.md`.
   Risco: R-07. Fase: 1.7. Aceite: banco não público; egress Anthropic bloqueado.

## P1 — bloqueiam piloto
8. Ambientes staging+production. Ev.: `ENVIRONMENT_STRATEGY.md`. Risco: R-08. Fase: 1.1.
9. Deploy reproduzível + rollback ensaiado. Ev.: `DEPLOYMENT_AND_PROMOTION.md`. R-09. Fase: 1.1.
10. Runbook de migration zero-downtime + gate. Ev.: `MIGRATION_RUNBOOK.md`. R-10. Fase: 1.3.
11. Incident response + runbooks + owners. Ev.: `INCIDENT_RESPONSE.md`. R-11. Fase: 1.7.
12. SLOs de piloto + baseline. Ev.: `SLI_SLO_FRAMEWORK.md`. R-12. Fase: 1.4/1.6.
13. Classificação de dados + retenção + exclusão de tenant. Ev.: `DATA_CLASSIFICATION_AND_RETENTION.md`. R-13. Fase: 1.7.
14. Revisão privacy/compliance (LGPD/GDPR). Risco: R-14. Fase: externa. Aceite: parecer legal.
15. Runbooks de worker/fila + métricas de fila. Ev.: `WORKER_AND_QUEUE_OPERATIONS.md`. Fase: 1.5.
16. Health checks padronizados `/livez` `/readyz`. Ev.: `health.controller.ts`. Fase: 1.4.

## P2 — antes de escala
17. Container scanning + SBOM + signed artifacts. R-15. Fase: 1.1.
18. Testes de carga + resiliência. R-16. Fase: 1.6.
19. Feature flags dinâmicas. R-17. Fase: 1.1.
20. Branch protection formal + environment approvals. Fase: 1.1.

## P3 — posterior
21. Mitigação adicional de vida de segredo (limitada pela plataforma). R-18.
22. (Bloqueado) Gates live Anthropic — fora do PRD-001. R-19.

**Piloto NÃO depende de Anthropic** (usa `internal.test-model`, só teste). Produção
comercial Anthropic permanece bloqueada até os gates deferidos próprios.

---
## Atualização ARDEN-PRD-001.1 (gap status)
- **#1 Secret manager + injeção em runtime:** PARTIALLY_CLOSED — fronteira neutra + fail-closed
  implementados (`security/platform-secret-source.ts`); adapter de produção
  BLOCKED_BY_EXTERNAL_DECISION.
- **#2 Backup da master key + keyring versionado + DR de chave:** PARTIALLY_CLOSED — keyring
  versionado + backup cifrado + restore verify + drill offline (`security/*`); backup/restore
  em infra real STILL_OPEN (PRD-001.2/1.3).
- **#4 Backup automatizado + restore drill:** PARTIALLY_CLOSED (keyring) — drill offline PASS;
  DATABASE restore drill UNVERIFIED / STILL_OPEN.
- Demais itens P0/P1/P2/P3: STILL_OPEN (inalterados nesta fase).

---
## Atualização ARDEN-PRD-001.1D
- **#2 master key lifecycle / recriptografia:** recriptografia PostgreSQL + CLI + preflight
  readiness → CLOSED (nível de aplicação); backup/restore em **infra real** STILL_OPEN (PRD-001.2).
- **#1 Secret manager:** PARTIALLY_CLOSED (fronteira/fail-closed/keyring/preflight); adapter de
  produção BLOCKED_BY_EXTERNAL_DECISION.
- Métricas externas + auditoria dedicada de recriptografia + gate de CI de recuperação: STILL_OPEN.

---
## Atualização ARDEN-PRD-001.2A
- **#1 Secret manager:** opções analisadas (`SECRET_MANAGER_OPTIONS.md`); adapter
  `EXTERNAL_SECRET_MANAGER` do contrato existente — implementação em 001.2B.5.
- **#3 Banco gerenciado HA+PITR:** opções (`MANAGED_POSTGRESQL_OPTIONS.md`) + pooling
  (`POSTGRESQL_POOLING_DECISION.md`) — habilitação em 001.2B.3/2B.4.
- **#4 Backup + restore drill:** política + plano de drill definidos — execução em 001.2B.8.
- **#7 Rede privada + egress deny:** decisão em `NETWORK_AND_EGRESS_DECISION.md` — 001.2B.2.
- Todos aguardam a decisão de negócio de infraestrutura (ADR-0001, `REQUIRES_BUSINESS_DECISION`).

---
## Atualização ARDEN-PRD-001.2A.1
- Pacote executivo de decisão criado (formulário, cotação, jurídico, residência, SLA,
  lock-in, RACI, registro de decisão, entry gate). Ver
  `ARDEN_PRD_001_2A_1_DECISION_PACKAGE_REPORT.md`.
- Itens P0/P1 dependentes de infraestrutura (secret manager, banco HA+PITR, backup/restore,
  rede/egress) permanecem STILL_OPEN e agora **bloqueados** pelo
  `ARDEN_PRD_001_2B_ENTRY_GATE = FAIL` até a decisão de negócio + ADR ACCEPTED.
