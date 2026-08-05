<!-- Milestone: ARDEN-PRD-001.2A -->
# ARDEN-PRD-001.2A — Comparação de opções de infraestrutura

Compara **4 arquiteturas coerentes** para o stack inicial de produção do Arden.AS.
Toda afirmação sobre capacidade de serviço remete ao `ARDEN_PRD_001_2A_SOURCE_REGISTER.md`
(status de verificação por fato). **Nenhum preço/SLA é inventado.** Escopo:
documentação — nada é provisionado.

## Forma do sistema a hospedar (do repositório, não de fonte externa)

- **Frontend:** SPA React 19 + Vite (`src/`) — artefato estático.
- **API:** NestJS + Fastify (`apps/api/`), container `node:22-slim`, `EXPOSE 3000`,
  `CMD node apps/api/dist/main.js` (`apps/api/Dockerfile`). Health: `/health`+`/live`
  (liveness), `/ready`+`/readyz` (readiness: database + connectorMasterKeyring preflight,
  fail-closed 503).
- **Worker:** mesmo código; consome fila em PostgreSQL via `FOR UPDATE SKIP LOCKED`,
  leases renováveis, heartbeat (`execution.worker.ts`, `execution.queue.ts`). **Bloqueia
  aquisição de job** se o keyring não estiver pronto (preflight fail-closed).
- **Migration job:** `prisma migrate deploy` — exige **conexão direta** (não pooler) — S2.2/S2.3.
- **Banco:** PostgreSQL 16 (`docker-compose.yml`, `schema.prisma` — 11 migrations,
  modelo `ConnectionCredentialVersion`).
- **Segredos de plataforma:** catálogo fechado `PLATFORM_SECRET_NAMES` (DATABASE_URL,
  CONNECTOR_MASTER_KEY_PRIMARY, CONNECTOR_MASTER_KEY_BACKUP_WRAPPING_KEY,
  SESSION_JWT_MATERIAL, OBSERVABILITY_TOKEN) atrás da interface neutra
  `PlatformSecretSource` (ARDEN-PRD-001.1). O secret manager escolhido implementa **um
  adapter** dessa interface — o contrato **não muda**.
- **CI:** GitHub Actions (`.github/workflows/ci.yml`, 4 jobs; Backend usa service
  `postgres:16`).

Requisitos inegociáveis do produto: **egress padrão DENY**, **Anthropic bloqueado**,
banco **não público**, secrets **fora do repo**, HA + PITR + restore drill antes de piloto.

## Arquiteturas comparadas

| | **A — AWS gerenciado** | **B — GCP gerenciado** | **C — Azure gerenciado** | **D — PaaS especializado** |
| --- | --- | --- | --- | --- |
| Compute API/worker | ECS Fargate / App Runner | Cloud Run | Container Apps | Fly.io Machines / Render / Railway |
| Frontend | S3+CloudFront / Amplify | Cloud Storage+CDN / Firebase Hosting | Static Web Apps | Vercel / Cloudflare Pages |
| PostgreSQL | RDS PostgreSQL (Multi-AZ) — S1.1–S1.3 | Cloud SQL (HA regional) — S1.4–S1.7 | Flexible Server (zone-redundant) — S1.8–S1.10 | Neon / Supabase — S1.11–S1.13 |
| Pooler | RDS Proxy / PgBouncer | Cloud SQL + PgBouncer | PgBouncer (built-in no Flexible Server*) | Pooler embutido (Neon PgBouncer / Supavisor) — S2.4/S2.5 |
| Secret manager | AWS Secrets Manager — S3.1 | GCP Secret Manager — S3.2 | Azure Key Vault — S3.3 | Doppler/Infisical/HCP Vault — S3.4 |
| Rede privada | VPC + subnets privadas + SG | VPC + PSA/PSC | VNet + Private Link | 6PN/rede privada — S6.1–S6.4 |
| Egress DENY | SG/NACL + endpoints; egress firewall | Firewall + Cloud NAT | NSG + Firewall | Network Policies (deny-all) — S6.1 |
| Registro de imagem | ECR — S7.2 | Artifact Registry — S7.3 | ACR | GHCR — S7.1 |
| Observabilidade | CloudWatch (+ externo) | Cloud Logging/Monitoring (+ externo) | Azure Monitor (+ externo) | Sentry + Grafana Cloud |
| Deploy/rollback | ECS rolling / CodeDeploy | Cloud Run revisions | Container Apps revisions | Imutável por release + rollback de revisão |

\* Recurso do provedor deve ser reconfirmado (PARTIALLY_VERIFIED).

## Eixos de decisão (qualitativo — sem números inventados)

| Eixo | A (AWS) | B (GCP) | C (Azure) | D (PaaS) |
| --- | --- | --- | --- | --- |
| Maturidade/gerenciado | Muito alta | Muito alta | Muito alta | Alta (varia por peça) |
| Simplicidade p/ time pequeno | Média (mais peças) | Média-alta | Média | **Alta** |
| Esforço operacional | Maior | Médio | Médio | **Menor** |
| Escala-para-zero / custo ocioso | Fargate não; App Runner sim | Cloud Run sim | Container Apps sim | Fly/Neon: sim/scale-to-zero |
| Controle fino de rede/egress | **Máximo** (VPC completo) | Alto | Alto | Médio (deny-all suportado — S6.1) |
| PITR + HA gerenciado | Sim — S1.1–S1.3 | Sim — S1.5/S1.6 | Sim — S1.9/S1.10 | Sim (Neon PITR — S1.12) |
| Lock-in | Alto | Alto | Alto | Médio-alto (portátil por peça) |
| Compatível c/ Prisma+pooling | Sim (com directUrl) — S2.* | Sim (directUrl) | Sim (directUrl) | Sim (directUrl) — S2.2 |
| Residência de dados configurável | Sim (região) — jurídico S8 | Sim | Sim | Varia por provedor — jurídico S8 |
| Custo | **REQUIRES_SALES_CONFIRMATION** | idem | idem | idem |
| SLA contratual | **REQUIRES_SALES_CONFIRMATION** (S4.1) | S4.2 | S4.3 | S4.4 |

## Leitura técnica (independente de preço)

- **Todas as quatro** satisfazem os requisitos técnicos essenciais (PG gerenciado, HA,
  PITR, backups, secret manager, rede privada, egress deny, registro OCI, deploy/rollback)
  **conforme fontes oficiais PARTIALLY_VERIFIED**. Nenhuma é tecnicamente eliminada.
- **A/B/C** dão o **maior controle de rede** (VPC/VNet completo) — favorável ao requisito
  de banco não-público + egress DENY + bloqueio Anthropic na camada de plataforma.
- **D** dá a **menor carga operacional** para um time pequeno e melhor custo ocioso
  (scale-to-zero em compute e banco), ao custo de controle de rede um pouco menor e
  maturidade heterogênea entre peças.
- O ponto de compatibilidade **Prisma + pooling** (S2.*) é satisfeito por todas desde que
  **migrations usem conexão direta** e o worker mantenha locking intra-transação (já é o
  caso). Ver `POSTGRESQL_POOLING_DECISION.md`.

## Por que não decidir agora (SELECTED) — o que falta

O critério de `INFRASTRUCTURE_DECISION: SELECTED` exige **não** haver decisão essencial de
negócio pendente. Pendem, e são de negócio/jurídico, não técnicas:

1. **Custo real** — todos os preços `REQUIRES_SALES_CONFIRMATION` (S5). Sem números
   oficiais, comparar TCO seria inventar.
2. **SLA contratual** — `REQUIRES_SALES_CONFIRMATION` (S4).
3. **Residência de dados / jurisdição / sub-processadores** — `REQUIRES_LEGAL_REVIEW` (S8).
4. **Apetite lock-in vs velocidade** — decisão estratégica do negócio (hyperscaler vs PaaS).

Por isso o resultado é `INFRASTRUCTURE_DECISION: REQUIRES_BUSINESS_DECISION` com finalistas
e recomendação técnica (ver `ARDEN_PRD_001_2A_DECISION_REPORT.md` e `ADR-0001`).
