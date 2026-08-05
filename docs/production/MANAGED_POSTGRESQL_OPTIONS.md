<!-- Milestone: ARDEN-PRD-001.2A -->
# ARDEN-PRD-001.2A — PostgreSQL gerenciado: análise das opções

Fatos remetem ao `ARDEN_PRD_001_2A_SOURCE_REGISTER.md` (S1, S2). Status máximo nesta fase:
`PARTIALLY_VERIFIED` (fetch direto bloqueado; reconfirmar contra páginas vivas).

## Requisitos do Arden.AS sobre o banco

- **PostgreSQL 16** (paridade com `docker-compose.yml`, CI service `postgres:16`,
  `schema.prisma`). Aceitável 16→17 desde que testado (major upgrade é evento planejado).
- **HA** com failover automático (gate "Database managed (HA)").
- **Backup automatizado** + **PITR** (gates BLOCKING "Backups enabled" / "Restore drill").
- **Pooling** compatível com Prisma + worker `FOR UPDATE SKIP LOCKED` + migrations diretas.
- **Conexão de admin/migração distinta** do pooler (S2.2/S2.3).
- **Banco não público** (rede privada) + egress controlado.
- Extensões usadas hoje: nenhuma exótica exigida pelo `schema.prisma` (revisar `pgcrypto`/
  `uuid` se necessário na fase de implementação; **não** é bloqueio conhecido).

## Comparação por provedor

| Critério | RDS PostgreSQL (A) | Cloud SQL (B) | Azure Flexible Server (C) | Neon (D) | Supabase (D) |
| --- | --- | --- | --- | --- | --- |
| PG 16/17 | S1.1 (índice lista majors) | S1.4 | S1.8 | S1.11 (14–17) | S1.13 |
| HA / failover | Multi-AZ standby — S1.1 | HA regional automático — S1.5 | Zone-redundant standby — S1.9 | Compute redundante gerenciado (reconfirmar) | Depende do plano (reconfirmar) |
| PITR | Sim — S1.2 | Sim (logs) — S1.6 | Sim — S1.10 | Instant restore (root branch) — S1.12 | Add-on em planos pagos — S1.13 |
| Backup automatizado | Sim, retenção config. — S1.3 | On por padrão — S1.7 | Default 7d, até 35d — S1.10 | Contínuo/branching — S1.12 | Depende do plano |
| Pooler recomendado | RDS Proxy / PgBouncer | PgBouncer | PgBouncer (built-in*) | PgBouncer embutido — S2.5 | Supavisor — S2.4 |
| Conexão direta p/ migrate | Sim (endpoint da instância) | Sim | Sim | Sim (endpoint direto) | Sim (5432 direto) |
| Rede privada | VPC/subnet privada | PSA/PSC | Private Link/VNet | Restrição de IP/privado (reconfirmar) | Restrição/privado (reconfirmar) |
| Escala-para-zero do banco | Não (instância provisionada) | Não (provisionada)** | Não (provisionada) | **Sim** (autosuspend) | Pausa em plano free |
| Major upgrade | Gerenciado (evento) | Gerenciado | In-place upgrade — S1.8 | Gerenciado | Gerenciado |
| SLA | REQUIRES_SALES_CONFIRMATION (S4.1) | S4.2 | S4.3 | S4.4 | S4.4 |
| Custo | REQUIRES_SALES_CONFIRMATION (S5) | idem | idem | idem | idem |

\* Recurso do provedor — reconfirmar (PARTIALLY_VERIFIED). \** Cloud SQL Enterprise tem
opções de autoscaling de storage; compute não escala-para-zero.

## Limites e riscos por classe

- **Hyperscaler (A/B/C):** instância provisionada 24/7 (custo ocioso maior no estágio
  dev/piloto); controle de rede máximo; PITR/HA maduros; SLA/preço a confirmar.
- **PaaS serverless (Neon):** scale-to-zero e branching reduzem custo/atrito em dev/staging;
  PITR por branch; **verificar** limites de conexões diretas, HA no plano-alvo, região e
  residência de dados (S8) antes de produção.
- **Supabase:** PITR e HA dependem de plano pago; validar antes de assumir para produção.

## Recomendação técnica (condicional, sem preço)

- **Não** há eliminação técnica: todas atendem PG16+HA+PITR+backup conforme S1 (a
  reconfirmar).
- Para **time pequeno com forte necessidade de custo ocioso baixo em dev/staging**, Neon
  (D) é tecnicamente atraente (scale-to-zero + branching para ambientes efêmeros).
- Para **máximo controle de rede/egress + maturidade de PITR/HA + residência clara**, um
  hyperscaler gerenciado (A/B/C) é mais conservador.
- A escolha final depende de **custo real (S5)**, **SLA (S4)** e **residência (S8)** —
  decisões de negócio/jurídico. Ver `ADR-0001`.

## Decisão de versão

- Alvo inicial: **PostgreSQL 16** (paridade com o repositório). Migração para 17 é um
  **evento planejado** com rehearsal de migration (gate "Migrations rehearsed") — não um
  requisito desta fase.
