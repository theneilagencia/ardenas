<!-- Milestone: ARDEN-PRD-001.2A -->
# ARDEN-PRD-001.2A — Avaliação de risco da decisão de infraestrutura

Riscos da **decisão** e da fase de **implementação futura** (001.2B). Complementa
`ARDEN_PRD_001_RISK_REGISTER.md`. Nenhum risco é mitigado nesta fase (documental).

## Riscos de evidência/decisão

| ID | Risco | Prob. | Impacto | Mitigação proposta |
| --- | --- | --- | --- | --- |
| RD-01 | Fatos de capacidade `PARTIALLY_VERIFIED` (fetch bloqueado) tratados como certos | Média | Alto | Reconfirmar cada fato S1–S7 contra a página viva antes de mover ADR para ACCEPTED |
| RD-02 | Preço/SLA assumido sem cotação → orçamento/expectativa errados | Média | Alto | Manter `REQUIRES_SALES_CONFIRMATION`; preencher `INFRASTRUCTURE_COST_MODEL.md` com cotação oficial |
| RD-03 | Decisão de plataforma tomada sem parecer jurídico de residência | Baixa | Crítico | Bloquear 001.2B até `REQUIRES_LEGAL_REVIEW` (S8) resolvido |
| RD-04 | Escolha do secret manager antes da plataforma → retrabalho | Média | Médio | Secret manager é consequência do ADR-0001; adapter neutro já isola o contrato |
| RD-05 | Lock-in subestimado | Média | Médio | Preferir padrões portáteis (OCI, PG padrão, adapter neutro); finalista D reduz lock-in |

## Riscos técnicos da implementação futura (001.2B)

| ID | Risco | Prob. | Impacto | Mitigação proposta |
| --- | --- | --- | --- | --- |
| RT-01 | Pooling em transaction mode quebra migrations | Média | Alto | Conexão **direta** (`directUrl`) para migrate; app usa pooler (`POSTGRESQL_POOLING_DECISION.md`) |
| RT-02 | Prepared statements incompatíveis com PgBouncer <1.21 | Baixa | Médio | `pgbouncer=true` na `DATABASE_URL` da app se pooler <1.21 (S2.1) |
| RT-03 | Esgotamento de conexões (N réplicas × pool) | Média | Alto | Dimensionar `connection_limit` + pool vs limite do plano; teste de fumaça |
| RT-04 | Restore do banco sem master key correta → credenciais ilegíveis | Baixa | Crítico | Drill prova banco + master key + decrypt canário (`DATABASE_RESTORE_DRILL_PLAN.md`) |
| RT-05 | Egress DENY mal configurado deixa Anthropic/rota indevida aberta | Baixa | Alto | Duas camadas (SSRF app + firewall plataforma); teste de inalcançabilidade |
| RT-06 | Wrapping key de backup acessível pela identidade de runtime | Baixa | Crítico | IAM: só `Restore operator` lê a wrapping key (`INFRASTRUCTURE_IAM_MODEL.md`) |
| RT-07 | Staging com dados reais sem anonimização | Baixa | Alto | Isolamento total + proibição de dados reais em staging (`ENVIRONMENT_ISOLATION.md`) |
| RT-08 | RTO/RPO reais piores que o alvo | Média | Médio | Medir no drill; não assumir números de marketing |

## Riscos jurídicos/regulatórios (não decididos — REQUIRES_LEGAL_REVIEW)

| ID | Assunto | Status |
| --- | --- | --- |
| RL-01 | Região de dados / transferência internacional | REQUIRES_LEGAL_REVIEW |
| RL-02 | Sub-processadores do provedor + DPA (LGPD/GDPR) | REQUIRES_LEGAL_REVIEW |
| RL-03 | Base legal p/ armazenar credenciais de terceiros (cofre) | REQUIRES_LEGAL_REVIEW |
| RL-04 | Retenção/eliminação/exportação por tenant | REQUIRES_LEGAL_REVIEW |

> Estes itens são **decisão jurídica**, não técnica. Este documento **não** emite parecer
> legal; apenas sinaliza que a decisão de plataforma depende deles.

## Gate de risco

001.2B não inicia enquanto RD-02, RD-03 e RL-01..RL-04 não estiverem resolvidos e o
ADR-0001 permanecer `PROPOSED`.
