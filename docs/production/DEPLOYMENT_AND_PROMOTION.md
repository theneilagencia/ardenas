<!-- Milestone: ARDEN-PRD-001 -->
# ARDEN-PRD-001 — Deploy e promoção

## Estado atual
`.github/workflows/ci.yml` valida (typecheck/lint/test/build/OpenAPI/E2E/backend com
`postgres:16` service). **Não há** publicação de artefato, deploy, ambientes de deploy,
rollback workflow, container scanning, SBOM ou provenance. Classificação: **MISSING**.

## Fluxo proposto (documental)
```
commit → PR → CI (gates) → build artifact imutável (imagem + FE estático) →
staging deploy → smoke → approval humano → production deploy → verification → (rollback se falhar)
```

## Requisitos
- **Artefato imutável** por commit SHA; **mesma imagem** em staging e produção.
- **Versionamento** por SHA + tag semântica; `deployment record` (quem/quando/o quê).
- **Migration gate** separado do rollout (ver `MIGRATION_RUNBOOK.md`) — migration NÃO roda
  em todas as réplicas automaticamente.
- **Approval humano** obrigatório antes de produção.
- **Rollback**: redeploy da imagem anterior; migrations expand/contract garantem
  compatibilidade retroativa.
- **Feature flags**: runtime Anthropic permanece OFF em produção (env-gate existente).

## Containers — auditoria
| Item | Estado | Classificação |
| --- | --- | --- |
| Dockerfile API | multi-stage `node:22-slim`, `USER node` | READY |
| HEALTHCHECK no Dockerfile | ausente | PARTIAL (usar `/ready` no orquestrador) |
| Graceful shutdown | referenciado em `worker.ts`, `bootstrap.ts`, `prisma.service.ts` | PARTIAL (validar SIGTERM/drain) |
| Migrations no entrypoint | ausente (correto) | READY |
| Frontend build | `npm run build` → estático | READY |
| Lockfile / `npm ci` | `Dockerfile` usa `npm ci` | READY |
| Image size / non-root | slim + `USER node` | READY |
| Worker termination | `worker.ts` | PARTIAL (validar drain de lease) |

## CI/CD — gaps
artifact publishing, signed artifacts, SBOM, dependency scanning, container scanning,
provenance, environment approvals, rollback workflow, deployment verification, branch
protection formal. Todos **MISSING** — priorizados em `PRIORITIZED_BACKLOG`.

## Decisão de infraestrutura
`REQUIRES EXTERNAL DECISION`. Critérios: experiência do time, custo, velocidade,
segurança, banco gerenciado, secret manager, observabilidade, escalabilidade, rede,
compliance, suporte, lock-in. Opções: AWS, Google Cloud, Azure, PaaS (Fly.io/Render/
Railway), híbrido. **Não** se conclui AWS por padrão. Hipótese registrada: uma PaaS com
Postgres gerenciado + secret manager acelera piloto com menor custo operacional; cloud
grande favorece escala/compliance de longo prazo. Decisão pertence ao dono do produto.

---
## Atualização ARDEN-PRD-001.2A
- A "Decisão de infraestrutura" acima passa a ter análise formal: `REQUIRES_BUSINESS_DECISION`
  com finalistas B (GCP), D (PaaS), A (AWS) — `ADR-0001` (PROPOSED) e
  `ARDEN_PRD_001_2A_DECISION_REPORT.md`.
- Promoção por **artefato imutável** (mesma imagem OCI) entre staging→production
  (`ENVIRONMENT_ISOLATION.md`); registro de imagem em `ARDEN_PRD_001_2A_SOURCE_REGISTER.md` (S7).
- Pipeline de deploy/rollback + migration job (conexão **direta**) especificados no plano
  faseado `INFRASTRUCTURE_IMPLEMENTATION_PLAN.md` (fase 001.2B.6). Não implementado nesta fase.
