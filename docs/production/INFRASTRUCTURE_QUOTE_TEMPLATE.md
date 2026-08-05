<!-- Milestone: ARDEN-PRD-001.2A.1 -->
# ARDEN-PRD-001.2A.1 — Modelo de cotação de infraestrutura

Template **idêntico** para os três finalistas (A/B/D), em três cenários. **Nenhum preço é
preenchido nesta fase.** Toda célula de valor = `REQUIRES_QUOTE` até anexar cotação
oficial. **Não converter moedas** sem taxa oficial registrada (data + fonte).

## Instruções
- Uma cópia por **finalista** (A, B, D) e por **cenário** (STAGING, PILOT, INITIAL_PRODUCTION).
- As **hipóteses** são preenchidas pelo **negócio** (não pelo autor técnico).
- Fonte deve ser calculadora oficial + proposta comercial (ver S5 do
  `ARDEN_PRD_001_2A_SOURCE_REGISTER.md`).

## Hipóteses (preenchidas pelo negócio)

| Hipótese | STAGING | PILOT | INITIAL_PRODUCTION |
| --- | --- | --- | --- |
| Região | `TBD` | `TBD` | `TBD` |
| Horas mensais (compute) | `TBD` | `TBD` | `TBD` |
| Réplicas de API | `TBD` | `TBD` | `TBD` |
| Réplicas de worker | `TBD` | `TBD` | `TBD` |
| CPU (por instância) | `TBD` | `TBD` | `TBD` |
| Memória (por instância) | `TBD` | `TBD` | `TBD` |
| Armazenamento (banco) | `TBD` | `TBD` | `TBD` |
| Volume do banco | `TBD` | `TBD` | `TBD` |
| Crescimento mensal | `TBD` | `TBD` | `TBD` |
| Conexões | `TBD` | `TBD` | `TBD` |
| Retenção de backup | `TBD` | `TBD` | `TBD` |
| Janela de PITR | `TBD` | `TBD` | `TBD` |
| Logs mensais | `TBD` | `TBD` | `TBD` |
| Métricas | `TBD` | `TBD` | `TBD` |
| Tracing | `TBD` | `TBD` | `TBD` |
| Egress | `TBD` | `TBD` | `TBD` |
| WAF | `TBD` | `TBD` | `TBD` |
| Suporte | `TBD` | `TBD` | `TBD` |
| Ambientes adicionais | `TBD` | `TBD` | `TBD` |
| Restore drills | `TBD` | `TBD` | `TBD` |

## Campos de resposta (por finalista × cenário)

| Campo | Valor |
| --- | --- |
| Fornecedor | `TBD` |
| Arquitetura (A/B/D) | `TBD` |
| Região | `TBD` |
| Moeda | `TBD` |
| Data da cotação (UTC) | `TBD` |
| Validade | `TBD` |
| Custo mensal estimado | `REQUIRES_QUOTE` |
| Custo mínimo contratado | `REQUIRES_QUOTE` |
| Custos variáveis | `REQUIRES_QUOTE` |
| Custos excluídos | `TBD` |
| Suporte | `TBD` |
| Descontos | `TBD` |
| Compromisso mínimo | `TBD` |
| Fonte (URL/proposta) | `TBD` |
| Responsável comercial | `TBD` |

## Registro de conversão de moeda (se aplicável)

| De | Para | Taxa oficial | Data (UTC) | Fonte |
| --- | --- | --- | --- | --- |
| `TBD` | `TBD` | `TBD` | `TBD` | `TBD` |

> Sem taxa oficial registrada, **não** converter. Apresentar na moeda original da cotação.
