<!-- Milestone: ARDEN-PRD-001.2A -->
# ARDEN-PRD-001.2A — Registro de fontes (evidência de infraestrutura)

Cada afirmação sobre serviços atuais deve vir de **fonte oficial**, registrada com
URL, título, data de acesso (UTC), fato suportado e **status de verificação**.

## Vocabulário de status

| Status | Significado |
| --- | --- |
| `VERIFIED` | Página oficial obtida **diretamente** (fetch completo) e o fato confere no corpo da página. |
| `PARTIALLY_VERIFIED` | URL de fonte oficial identificada e o fato aparece em **resumo indexado do domínio oficial**, mas o corpo da página **não pôde ser obtido diretamente neste ambiente** (fetch bloqueado). Requer reconfirmação humana contra a página viva antes de decisão ACEITA. |
| `UNVERIFIED` | Não foi possível confirmar por fonte oficial. |
| `REQUIRES_SALES_CONFIRMATION` | Preço, SLA contratual, cota ou limite comercial que depende de plano/região/negociação — só confirmável por proposta/cotação oficial. |
| `REQUIRES_LEGAL_REVIEW` | Residência de dados, transferência internacional, sub-processadores, base legal — decisão jurídica, fora do escopo técnico. |

## Restrição do ambiente (impacto na verificação) — CRÍTICO

Neste ambiente de execução, **todas as tentativas de `WebFetch` a domínios de
documentação retornaram HTTP 403 Forbidden** (verificado em 2026-08-05T12:40Z para
`docs.aws.amazon.com`, `docs.cloud.google.com`, `neon.tech`, `www.prisma.io`). O
mecanismo de busca (`WebSearch`) retorna **resumos indexados de domínios oficiais**,
porém a especificação ARDEN-PRD-001.2A determina **"não usar snippets de busca como
evidência final"**.

**Consequência:** nenhum fato de capacidade de serviço atual pode ser elevado a
`VERIFIED` nesta fase. O teto honesto é `PARTIALLY_VERIFIED` (URL oficial localizada +
resumo do domínio oficial), exigindo reconfirmação humana contra a página viva. Preços
e SLAs permanecem `REQUIRES_SALES_CONFIRMATION`; residência/compliance permanecem
`REQUIRES_LEGAL_REVIEW`. Isto, por si só, torna o resultado desta fase
`REQUIRES_BUSINESS_DECISION` (ver decisão em `ADR-0001` e relatório em
`ARDEN_PRD_001_2A_DECISION_REPORT.md`).

Data de acesso comum a todas as consultas abaixo: **2026-08-05 (UTC)**.

---

## S1 — PostgreSQL gerenciado: versões, HA, PITR, backup

| # | Fonte oficial (URL) | Título | Fato suportado | Status |
| --- | --- | --- | --- | --- |
| S1.1 | https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_PostgreSQL.html | Amazon RDS for PostgreSQL — User Guide | RDS oferece PostgreSQL gerenciado; Multi-AZ com standby; backup automatizado; PITR dentro da janela de retenção. Página **não fetchável** (403) neste ambiente. | PARTIALLY_VERIFIED |
| S1.2 | https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_PIT.html | Restoring a DB instance to a specified time (RDS) | PITR: restaura a qualquer ponto dentro da janela de retenção de backup. | PARTIALLY_VERIFIED |
| S1.3 | https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_WorkingWithAutomatedBackups.html | Introduction to backups (RDS) | Backups automatizados habilitados; retenção configurável. | PARTIALLY_VERIFIED |
| S1.4 | https://docs.cloud.google.com/sql/docs/postgres/db-versions | Cloud SQL for PostgreSQL — supported versions | Cloud SQL suporta múltiplas majors de PostgreSQL (inclui 16/17 conforme índice). Página **não fetchável** (403). | PARTIALLY_VERIFIED |
| S1.5 | https://docs.cloud.google.com/sql/docs/postgres/high-availability | About high availability (Cloud SQL) | HA regional com failover automático entre zonas; SLA de disponibilidade associado ao plano (ver S4). | PARTIALLY_VERIFIED |
| S1.6 | https://docs.cloud.google.com/sql/docs/postgres/backup-recovery/pitr | Perform point-in-time recovery (Cloud SQL) | PITR baseado em logs de transação; janela configurável por edição. | PARTIALLY_VERIFIED |
| S1.7 | https://docs.cloud.google.com/sql/docs/postgres/backup-recovery/backups | Cloud SQL backups overview | Backups automatizados on por padrão; retenção configurável (default varia por edição). | PARTIALLY_VERIFIED |
| S1.8 | https://learn.microsoft.com/en-us/azure/postgresql/flexible-server/concepts-supported-versions | Supported versions — Azure DB for PostgreSQL Flexible Server | Flexible Server suporta majors incluindo 16/17 conforme índice. Página **não fetchável** (403). | PARTIALLY_VERIFIED |
| S1.9 | https://learn.microsoft.com/en-us/azure/postgresql/high-availability/concepts-high-availability | High Availability (Azure Flexible Server) | HA zone-redundant com standby quente; failover automático; SLA associado (ver S4). | PARTIALLY_VERIFIED |
| S1.10 | https://learn.microsoft.com/en-us/azure/postgresql/backup-restore/concepts-backup-restore | Backup and Restore (Azure Flexible Server) | Backups automáticos em armazenamento redundante; PITR suportado; retenção configurável (default 7d, até 35d conforme índice). | PARTIALLY_VERIFIED |
| S1.11 | https://neon.tech/docs/introduction/support | Neon — Postgres version support | Neon suporta PostgreSQL 14–17 (18 em deploy conforme índice). Página **não fetchável** (403). | PARTIALLY_VERIFIED |
| S1.12 | https://neon.tech/docs/guides/branching-pitr | Neon — Instant restore (PITR) | Restore instantâneo/PITR a partir de root branches; child branches não suportam. | PARTIALLY_VERIFIED |
| S1.13 | https://supabase.com/docs/guides/database/overview | Supabase — Database overview | Supabase provê PostgreSQL gerenciado; PITR e backups conforme plano (add-on em planos pagos). | PARTIALLY_VERIFIED |

## S2 — Pooling e compatibilidade com Prisma (decisivo)

| # | Fonte oficial (URL) | Título | Fato suportado | Status |
| --- | --- | --- | --- | --- |
| S2.1 | https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/databases-connections/pgbouncer | Configure Prisma Client with PgBouncer | Prisma funciona com PgBouncer em **transaction mode**. Página **não fetchável** (403). | PARTIALLY_VERIFIED |
| S2.2 | https://www.prisma.io/docs/guides/performance-and-optimization/connection-management/configure-for-external-connection-pooler | Configure Prisma with an external connection pooler | Comandos do Prisma que exigem **conexão direta** (migrations) usam `directUrl`; o Schema Engine **não suporta** pooling via PgBouncer e deve conectar direto. | PARTIALLY_VERIFIED |
| S2.3 | https://www.prisma.io/docs/orm/reference/prisma-config-reference | Prisma config reference (`directUrl`, v7 `prisma.config.ts`) | `directUrl`/`shadowDatabaseUrl` para conexão direta em migrate; na v7 o valor de migração migra para `prisma.config.ts`. | PARTIALLY_VERIFIED |
| S2.4 | https://supabase.com/docs/guides/database/connecting-to-postgres | Supabase — Connect to your database (Supavisor) | Transaction mode (porta 6543) para pooling; session state/prepared statements não persistem entre transações no modo transaction. | PARTIALLY_VERIFIED |
| S2.5 | https://neon.tech/docs/connect/connection-pooling | Neon — Connection pooling (PgBouncer) | Pooler PgBouncer embutido por endpoint; suporta muitas conexões concorrentes. | PARTIALLY_VERIFIED |

**Fato técnico central (S2.1–S2.4):** em **transaction pooling**, `SET`, prepared
statements, advisory locks e tabelas temporárias **não sobrevivem** ao limite da
transação. Isso é compatível com o Arden.AS **desde que**: (a) migrations usem conexão
**direta** (admin), não o pooler; (b) o worker use locking **dentro de uma única
transação** (`FOR UPDATE SKIP LOCKED`) — que é o caso; (c) não se dependa de advisory
locks de sessão nem de estado de sessão entre transações. Ver `POSTGRESQL_POOLING_DECISION.md`.

## S3 — Secret manager

| # | Fonte oficial (URL) | Título | Fato suportado | Status |
| --- | --- | --- | --- | --- |
| S3.1 | https://docs.aws.amazon.com/secretsmanager/latest/userguide/intro.html | AWS Secrets Manager — User Guide | Armazenamento de segredos, rotação automatizada (via Lambda), controle por IAM no nível do segredo. Não fetchável (403). | PARTIALLY_VERIFIED |
| S3.2 | https://docs.cloud.google.com/secret-manager/docs/overview | Google Cloud Secret Manager — overview | Segredos versionados, IAM por segredo, rotação via automação (Cloud Functions/Scheduler). | PARTIALLY_VERIFIED |
| S3.3 | https://learn.microsoft.com/en-us/azure/key-vault/general/overview | Azure Key Vault — overview | Cofre de segredos/chaves, RBAC no nível do cofre, integração com identidade gerenciada. | PARTIALLY_VERIFIED |
| S3.4 | https://developer.hashicorp.com/vault/docs | HashiCorp Vault — docs | Cofre self-hosted/HCP; rotação dinâmica; políticas por caminho. | PARTIALLY_VERIFIED |

## S4 — SLA (disponibilidade contratual)

| # | Fonte oficial (URL) | Título | Fato suportado | Status |
| --- | --- | --- | --- | --- |
| S4.1 | https://aws.amazon.com/rds/sla/ | Amazon RDS Service Level Agreement | SLA contratual do RDS (percentual mensal e créditos) — número exato depende de configuração/região. | REQUIRES_SALES_CONFIRMATION |
| S4.2 | https://cloud.google.com/sql/sla | Cloud SQL SLA | SLA contratual do Cloud SQL (HA) — número exato depende de edição/config. | REQUIRES_SALES_CONFIRMATION |
| S4.3 | https://azure.microsoft.com/en-us/support/legal/sla/postgresql/ | Azure DB for PostgreSQL SLA | SLA contratual do Flexible Server (zone-redundant vs same-zone). | REQUIRES_SALES_CONFIRMATION |
| S4.4 | https://neon.tech/docs/introduction/support (planos) | Neon — planos/SLA | SLA depende do plano (Business/Enterprise). | REQUIRES_SALES_CONFIRMATION |

> Nota: valores de SLA aparecem em resumos indexados (ex.: Cloud SQL HA ~99,95%; Azure
> zone-redundant failover 60–120s), porém **não foram confirmados por fetch direto** e
> variam por configuração/região/plano. **Não** são reproduzidos como número final nesta fase.

## S5 — Preço (custo de infraestrutura)

Todos os preços de compute, banco, secret manager, egress, observabilidade e registro
de imagem dependem de **região, plano, tamanho de instância, retenção e volume**, e só
são confiáveis via **calculadora oficial + cotação**. Nesta fase permanecem
`REQUIRES_SALES_CONFIRMATION`. **Nenhum número de preço é inventado** (ver
`INFRASTRUCTURE_COST_MODEL.md`). URLs oficiais de referência (calculadoras):

| # | Fonte oficial (URL) | Escopo | Status |
| --- | --- | --- | --- |
| S5.1 | https://calculator.aws/ | AWS Pricing Calculator | REQUIRES_SALES_CONFIRMATION |
| S5.2 | https://cloud.google.com/products/calculator | Google Cloud Pricing Calculator | REQUIRES_SALES_CONFIRMATION |
| S5.3 | https://azure.microsoft.com/en-us/pricing/calculator/ | Azure Pricing Calculator | REQUIRES_SALES_CONFIRMATION |
| S5.4 | https://neon.tech/pricing | Neon pricing | REQUIRES_SALES_CONFIRMATION |
| S5.5 | https://fly.io/docs/about/pricing/ | Fly.io pricing | REQUIRES_SALES_CONFIRMATION |
| S5.6 | https://render.com/pricing | Render pricing | REQUIRES_SALES_CONFIRMATION |
| S5.7 | https://vercel.com/pricing | Vercel pricing | REQUIRES_SALES_CONFIRMATION |
| S5.8 | https://sentry.io/pricing/ | Sentry pricing | REQUIRES_SALES_CONFIRMATION |
| S5.9 | https://grafana.com/pricing/ | Grafana Cloud pricing | REQUIRES_SALES_CONFIRMATION |

## S6 — Compute / PaaS e rede/egress

| # | Fonte oficial (URL) | Título | Fato suportado | Status |
| --- | --- | --- | --- | --- |
| S6.1 | https://fly.io/docs/machines/guides-examples/network-policies/ | Fly.io — Network Policies | Ao criar regra para uma direção (ingress/egress), o default daquela direção passa a **deny all**; só o tráfego explicitamente permitido é liberado. | PARTIALLY_VERIFIED |
| S6.2 | https://fly.io/docs/networking/private-networking/ | Fly.io — Private Networking (6PN) | Rede privada IPv6 entre máquinas; redes privadas customizadas para isolamento. | PARTIALLY_VERIFIED |
| S6.3 | https://render.com/docs/private-services | Render — Private Services | Serviços privados sem endpoint público; comunicação interna. | PARTIALLY_VERIFIED |
| S6.4 | https://docs.railway.com/reference/private-networking | Railway — Private Networking | Rede privada entre serviços out-of-the-box. | PARTIALLY_VERIFIED |
| S6.5 | https://vercel.com/docs | Vercel — docs (frontend hosting) | Hospedagem de frontend estático/edge para a SPA. | PARTIALLY_VERIFIED |
| S6.6 | https://developers.cloudflare.com/pages/ | Cloudflare Pages — docs | Hospedagem de frontend estático/edge. | PARTIALLY_VERIFIED |

### Egress DENY por padrão e bloqueio Anthropic
Independentemente do provedor, o **egress padrão deve ser DENY** e o egress para a
Anthropic deve permanecer **bloqueado** (invariante do produto — provider Anthropic
DISABLED). A aplicação **já** possui defesa em profundidade na camada de aplicação
(`SecureHttpClient` + SSRF guard + network policy, ARDEN-BE-006.5); a decisão de rede de
infraestrutura em `NETWORK_AND_EGRESS_DECISION.md` **adiciona** o egress DENY na camada de
plataforma, não o substitui.

## S7 — Registro de imagem / deploy

| # | Fonte oficial (URL) | Título | Fato suportado | Status |
| --- | --- | --- | --- | --- |
| S7.1 | https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry | GitHub Container Registry (GHCR) | Registro OCI integrado ao GitHub Actions (CI já usa GitHub). | PARTIALLY_VERIFIED |
| S7.2 | https://docs.aws.amazon.com/AmazonECR/latest/userguide/what-is-ecr.html | Amazon ECR | Registro OCI gerenciado com scan de imagem. | PARTIALLY_VERIFIED |
| S7.3 | https://docs.cloud.google.com/artifact-registry/docs | Google Artifact Registry | Registro OCI gerenciado. | PARTIALLY_VERIFIED |

## S8 — Residência de dados / compliance (jurídico)

| # | Assunto | Status |
| --- | --- | --- |
| S8.1 | Região de dados (UE vs BR vs US) e transferência internacional | REQUIRES_LEGAL_REVIEW |
| S8.2 | Sub-processadores do provedor e DPA (LGPD/GDPR) | REQUIRES_LEGAL_REVIEW |
| S8.3 | Base legal para armazenamento de credenciais de terceiros (cofre) | REQUIRES_LEGAL_REVIEW |
| S8.4 | Retenção/eliminação e exportação por tenant | REQUIRES_LEGAL_REVIEW |

Nenhum item S8 é decidido nesta fase; ver `docs/production/DATA_CLASSIFICATION_AND_RETENTION.md`
e `ARDEN_PRD_001_2A_RISK_ASSESSMENT.md`.

---

## Resumo de honestidade probatória

- `VERIFIED`: **0** fatos (fetch direto bloqueado no ambiente).
- `PARTIALLY_VERIFIED`: capacidades técnicas (versões PG, HA, PITR, backups, pooling,
  secret managers, rede/egress) — **exigem reconfirmação humana** contra páginas vivas.
- `REQUIRES_SALES_CONFIRMATION`: todos os preços e SLAs contratuais.
- `REQUIRES_LEGAL_REVIEW`: residência de dados e compliance.

Esta distribuição probatória é **suficiente** para uma recomendação técnica com
finalistas, porém **insuficiente** para `INFRASTRUCTURE_DECISION: SELECTED`. Ver ADR-0001.
