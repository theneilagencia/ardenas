<!-- Milestone: ARDEN-PRD-001 -->
# ARDEN-PRD-001 — Production Readiness: auditoria de escopo

> **Auditoria exclusivamente documental.** Nenhuma infraestrutura, deploy, secret real,
> ambiente ou habilitação de produção foi criada. O objetivo é mapear o que falta para
> operar o Arden.AS em produção com segurança, confiabilidade, observabilidade e
> recuperação — **sem ampliar o escopo funcional** e **mantendo Anthropic bloqueado**.

## Método
Cada conclusão usa evidência `file:line` ou uma classificação explícita: `NOT FOUND`,
`NOT IMPLEMENTED`, `NOT VERIFIED`, `REQUIRES EXTERNAL DECISION`. Nada é preenchido por
suposição.

## Classificação geral da prontidão de produção
**Overall: NOT PRODUCTION-READY (aplicação funcional; operação de produção não estabelecida).**
A aplicação é funcional e testável (1051 testes verdes no merge do ARDEN-BE-008), mas os
requisitos operacionais de produção — ambientes gerenciados, gestão de secrets externa,
backup/restore comprovado, observabilidade externalizada, alertas, DR, incident response
e piloto — **não existem** ainda.

## Resumo por dimensão

| Dimensão | Estado atual | Classificação | Doc |
| --- | --- | --- | --- |
| Aplicação (FE/API/worker/queue/vault) | implementada e testada | **READY (código)** / não operacionalizada | ARCHITECTURE |
| Ambientes | apenas local/test/CI | **MISSING** (staging/production) | ENVIRONMENT_STRATEGY |
| Deploy/promoção | CI valida; sem deploy | **MISSING** | DEPLOYMENT_AND_PROMOTION |
| Containers | Dockerfile multi-stage, sem HEALTHCHECK | **PARTIAL** | DEPLOYMENT_AND_PROMOTION |
| Secrets/keys | env-var + validação; sem secret manager | **PARTIAL / P0** | SECRETS_AND_KEY_MANAGEMENT |
| Connector master key (recuperação) | cofre AES-256-GCM; sem backup/DR da chave | **P0 crítico** | SECRETS_AND_KEY_MANAGEMENT |
| Banco | Prisma+migrations; sem HA/PITR gerenciado | **PARTIAL / P0** | DATABASE_OPERATIONS |
| Migrations em produção | `migrate deploy` existe; sem runbook zero-downtime | **PARTIAL** | MIGRATION_RUNBOOK |
| Backup/restore | **NOT FOUND** | **MISSING / P0** | BACKUP_AND_RESTORE |
| Worker/queue | PG queue com SKIP LOCKED/lease/retry | **READY (código)** / sem runbooks | WORKER_AND_QUEUE_OPERATIONS |
| Observabilidade externa | métricas in-memory + logs estruturados | **MISSING (externa) / P0** | OBSERVABILITY_STRATEGY |
| Alertas | **NOT FOUND** | **MISSING / P0** | ALERT_CATALOG |
| SLO/SLI | **NOT FOUND** | **MISSING / P1** | SLI_SLO_FRAMEWORK |
| Segurança operacional | guards/SSRF/vault implementados; IAM/MFA externos ausentes | **PARTIAL** | SECURITY_OPERATIONS |
| Data classification/retenção | não formalizada | **MISSING / P1** | DATA_CLASSIFICATION_AND_RETENTION |
| Disaster recovery | **NOT FOUND** | **MISSING / P0** | DISASTER_RECOVERY |
| Incident response | **NOT FOUND** | **MISSING / P1** | INCIDENT_RESPONSE |
| Performance/carga | **NOT FOUND** | **MISSING / P1** | PERFORMANCE_AND_LOAD_TEST_PLAN |
| Piloto | **NOT FOUND** | **MISSING / P1** | PILOT_READINESS |
| Go-live gates | definidos neste milestone | **DOCUMENTED** | GO_LIVE_GATES |
| Anthropic em produção | DISABLED / bloqueado | **DEFERRED (mantido bloqueado)** | ANTHROPIC_PRODUCTION_DEFERRED_GATES |

## Funcionalidades que podem ir a produção SEM Anthropic
Operações, versões, aprovações, gradientes de autoridade, governança, auditoria,
evidências, conectores HTTP/webhook, agentes com `internal.test-model`, usage/custo
(custo conhecido zero) — todo o produto exceto execução comercial Anthropic. O provider
`internal.test-model` permanece `productionAllowed=false` (só teste), portanto um piloto
inicial não depende de nenhum provider comercial.

## Gates adicionais Anthropic pendentes
Live smoke, live tool calling, pricing, retention, training, data residency, DPA,
sub-processors — todos permanecem bloqueadores de produção Anthropic (ver
`ANTHROPIC_PRODUCTION_DEFERRED_GATES.md`). Este milestone **não** os resolve.
