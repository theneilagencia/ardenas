<!-- Milestone: ARDEN-PRD-001.2A.1 -->
# ARDEN-PRD-001.2A.1 — Checklist de SLA e suporte

SLA **não** pode ser preenchido sem **contrato**. Enquanto sem contrato, cada célula de
SLA = `REQUIRES_SALES_CONFIRMATION`. Uma cópia por finalista (A/B/D).

Fornecedor: `TBD` · Data (UTC): `TBD` · Fonte (contrato/proposta): `TBD`

## SLA

| Item | Valor | Fonte contratual |
| --- | --- | --- |
| SLA de disponibilidade do banco | `REQUIRES_SALES_CONFIRMATION` | `TBD` |
| SLA do compute | `REQUIRES_SALES_CONFIRMATION` | `TBD` |
| SLA do secret manager | `REQUIRES_SALES_CONFIRMATION` | `TBD` |
| Créditos por violação de SLA | `REQUIRES_SALES_CONFIRMATION` | `TBD` |
| Exclusões de SLA | `TBD` | `TBD` |
| Medição/janela do SLA | `TBD` | `TBD` |

## Suporte

| Item | Valor | Fonte |
| --- | --- | --- |
| Plano de suporte | `TBD` | `TBD` |
| Cobertura (24×7 / horário comercial) | `TBD` | `TBD` |
| Severidades definidas | `TBD` | `TBD` |
| Tempo de resposta por severidade | `TBD` | `TBD` |
| Canal (ticket/telefone/chat) | `TBD` | `TBD` |
| Status page | `TBD` | `TBD` |
| Histórico de incidentes | `TBD` | `TBD` |
| Gerente de conta técnico | `TBD` | `TBD` |

## Alinhamento com RPO/RTO aprovados

| Métrica | Alvo proposto (2A) | Confirmado por contrato/drill | Aprovado por |
| --- | --- | --- | --- |
| RPO | ≤ 5 min (proposto) | `TBD` | `TBD` |
| RTO piloto | ≤ 4 h (proposto) | `TBD` (drill) | `TBD` |
| RTO produção | ≤ 1 h (proposto) | `TBD` (drill) | `TBD` |

> Alvos propostos vêm de `DATABASE_BACKUP_AND_PITR_POLICY.md`. **Não** são SLA; só viram
> aprovados após contrato (SLA) + medição no restore drill. Referência: S4 do
> `ARDEN_PRD_001_2A_SOURCE_REGISTER.md`.

## Regra

- `SLA confirmed = YES` no registro de decisão exige **contrato anexado**.
- `Support plan confirmed = YES` exige plano/proposta anexada.
- Sem esses, ambos permanecem `NO` e o entry gate = FAIL.
