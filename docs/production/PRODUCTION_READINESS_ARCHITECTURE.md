<!-- Milestone: ARDEN-PRD-001 -->
# ARDEN-PRD-001 — Inventário da arquitetura atual

Evidência `file:line` do que existe hoje. "Produção-ready" = operável em produção com
segurança/observabilidade/recuperação — não apenas implementado.

| Componente | Implementado | Executável | Produção-ready | Gap |
| --- | --- | --- | --- | --- |
| Frontend React/PWA | SIM (`src/`, `vite.config.ts`, PWA via `dist/sw.js`) | SIM (build+preview) | PARCIAL | hosting estático + CDN + cache/headers não definidos |
| API Node/TypeScript | SIM (`apps/api/src/main.ts`, NestJS+Fastify) | SIM | PARCIAL | réplicas, autoscaling, config externa |
| PostgreSQL | SIM (`apps/api/prisma/schema.prisma`) | SIM (local/CI `postgres:16`) | NÃO | instância gerenciada, HA, PITR, pooling |
| Prisma migrations | SIM (11 migrations em `apps/api/prisma/migrations/`) | SIM (`migrate deploy`) | PARCIAL | runbook zero-downtime, gate de execução |
| Worker | SIM (`apps/api/src/worker.ts`, `executions/execution.worker.ts`) | SIM | PARCIAL | escala, monitoramento, runbooks |
| Execution queue | SIM (`executions/execution.queue.ts`) | SIM | PARCIAL | métricas de fila + alertas |
| Lease/retry | SIM (`execution.queue.ts:44` FOR UPDATE SKIP LOCKED; `:66` heartbeat; `:81` release retry) | SIM | PARCIAL | recuperação de job preso (runbook) |
| Approvals | SIM (`apps/api/src/approvals/`) | SIM | PARCIAL | alertas de aprovação pendente |
| Audit | SIM (`apps/api/src/audit/`) | SIM | PARCIAL | retenção + monitoramento |
| Evidence | SIM (evidence refs em resultados) | SIM | PARCIAL | classificação + retenção |
| Connectors | SIM (`apps/api/src/connectors/`) | SIM | PARCIAL | egress allowlist de produção |
| Webhooks | SIM (`connectors/` webhooks) | SIM | PARCIAL | ingress + rate limit |
| SecretVault | SIM (`connectors/vault/`, AES-256-GCM) | SIM | NÃO | secret manager + backup/DR da master key |
| Agents | SIM (`apps/api/src/agents/`) | SIM | PARCIAL | provider comercial ainda bloqueado |
| Usage/cost | SIM (`agents/` usage; `agent-format.ts`) | SIM | PARCIAL | rollups em escala + monitoramento |
| Metrics in-memory | SIM (`agents/governance/agent-metrics.ts`) | SIM | NÃO | exportação externa (OTel/Prometheus) |
| Logs estruturados | SIM (`common/logging/logger.module.ts`, Pino) | SIM | PARCIAL | agregação/retenção externa |
| Feature flags | PARCIAL (env-gates de runtime Anthropic) | SIM | NÃO | sistema de flags dinâmico |
| Tenant isolation | SIM (`authz/guards/organization.guard.ts`; cross-tenant 404 testado) | SIM | PARCIAL | regressão contínua em produção |
| Authentication | SIM (`authz/guards/authentication.guard.ts`; Supabase JWKS + fake) | SIM | PARCIAL | IdP de produção + rotação de chaves |
| Authorization | SIM (`authz/guards/permission.guard.ts`, `active-user.guard.ts`) | SIM | PARCIAL | revisão de least-privilege |
| Frontend API provider | SIM (`src/services/api/`, modo `api`) | SIM | PARCIAL | config de base URL por ambiente |

## Camadas executáveis (fluxo de produção proposto)
```
CDN/edge → Frontend estático (PWA) → API (NestJS/Fastify, stateless, N réplicas)
         → PostgreSQL (gerenciado, HA, PITR)
         → Worker (processo separado; queue própria no PostgreSQL)
         → Integrações externas (egress allowlist; Anthropic em DENY)
         → Observabilidade (logs/metrics/traces externalizados)
```

## Health/readiness (existente)
`apps/api/src/health/health.controller.ts:25` `GET /health` (liveness, 200 mesmo sem
banco); `:35` `GET /ready` (readiness — testa `prisma.ping()`, 200/503). Proposta de
padronização em `OBSERVABILITY_STRATEGY.md`.

## Container (existente)
`apps/api/Dockerfile`: multi-stage (`FROM node:22-slim AS build`/`runtime`), `USER node`
(não-root), `EXPOSE 3000`, `CMD node apps/api/dist/main.js`. **Sem `HEALTHCHECK`**; sem
execução de migration no entrypoint (correto — migration deve ser gate separado).
`docker-compose.yml` para dev local.

---
## Atualização ARDEN-PRD-001.2A
- Decisão de infraestrutura consolidada em `docs/decisions/ADR-0001-PRODUCTION-INFRASTRUCTURE.md`
  (PROPOSED, `REQUIRES_BUSINESS_DECISION`) e `ARDEN_PRD_001_2A_DECISION_REPORT.md`.
- Documentos de arquitetura de produção adicionados: comparação de opções, PostgreSQL
  gerenciado, pooling, secret manager, IAM, rede/egress, isolamento de ambientes, custo,
  backup/PITR, restore drill e plano de implementação 001.2B (todos em `docs/production/`).
- Contrato `PlatformSecretSource` acomoda qualquer secret manager (adapter
  `EXTERNAL_SECRET_MANAGER`) sem redesenho. Anthropic permanece DISABLED.
