<!-- Milestone: ARDEN-PRD-001 -->
# ARDEN-PRD-001 — Plano de implementação (Production Readiness)

**Auditoria documental.** Nenhum código, migration, OpenAPI, dependência, CI ou deploy foi
alterado. Objetivo: preparar o Arden.AS para operação de produção sem ampliar escopo
funcional e mantendo Anthropic bloqueado.

## Fases propostas (consolidar/dividir conforme gaps reais)
| Fase | Foco | Principais gaps (P0 em negrito) |
| --- | --- | --- |
| PRD-001.1 | Deployment architecture & environments | staging/prod, artefato imutável, promoção |
| PRD-001.2 | Secrets, configuration & identity | **secret manager**, **master key backup/rotation**, IdP prod |
| PRD-001.3 | Database, migrations, backup & restore | **banco gerenciado/HA**, **backup+restore drill**, runbook migration |
| PRD-001.4 | Observability, alerts & SLOs | **observabilidade externa**, **alertas**, SLOs |
| PRD-001.5 | Worker resilience & operational runbooks | runbooks de fila, métricas de worker |
| PRD-001.6 | Performance, load & failure testing | baseline, carga, resiliência |
| PRD-001.7 | Security hardening & incident response | IAM/MFA, rede privada, incident response |
| PRD-001.8 | Controlled pilot readiness | staging pilot, tenant isolado, exit criteria |
| PRD-001.9 | Final production readiness audit | go-live gates, sign-off |

Recomendação de sequência: **1.2 e 1.3 primeiro** (secrets/master key + backup/restore são
os P0 de maior risco), depois 1.1/1.4, depois 1.5–1.9. Não adotar a divisão
automaticamente — dono do produto valida.

## Regras do milestone
- Somente documentação nesta execução (este commit).
- Cada fase futura terá seu próprio branch/PR.
- Anthropic permanece bloqueado em todas as fases (nenhuma habilitação de produção aqui).
- Não iniciar `ARDEN-PRD-001.1` nesta execução.

## Referências
`docs/production/*` (scope, architecture, environments, deployment, secrets, database,
migration, backup/restore, worker/queue, observability, alerts, SLO, security, data,
DR, incident, performance, pilot, go-live, anthropic-deferred) +
`ARDEN_PRD_001_RISK_REGISTER.md` + `ARDEN_PRD_001_PRIORITIZED_BACKLOG.md`.
