<!-- Milestone: ARDEN-PRD-001.2A.1 -->
# ARDEN-PRD-001.2A.1 — Modelo de registro de decisão

Modelo a ser preenchido **quando** a decisão humana for tomada. Enquanto qualquer
aprovação **bloqueante** estiver ausente, o `ADR-0001` permanece **PROPOSED** e o
`ARDEN_PRD_001_2B_ENTRY_GATE` = **FAIL**. **Nada aqui é preenchido nesta fase.**

## Registro

| Campo | Valor |
| --- | --- |
| Decision ID | `TBD` |
| Date (UTC) | `TBD` |
| Selected alternative (A/B/D) | `TBD` |
| Selected region | `TBD` |
| Selected PostgreSQL | `TBD` |
| Selected compute | `TBD` |
| Selected secret manager | `TBD` |
| Selected observability | `TBD` |
| Approved staging budget | `TBD` |
| Approved pilot budget | `TBD` |
| Approved production budget | `TBD` |
| Approved RPO | `TBD` |
| Approved RTO | `TBD` |
| Legal status | `NOT_REVIEWED` |
| Security status | `NOT_REVIEWED` |
| Business approver (cargo) | `TBD` |
| Legal approver (cargo) | `TBD` |
| Technical approver (cargo) | `TBD` |
| Operations approver (cargo) | `TBD` |
| Conditions | `TBD` |
| Expiration/review date | `TBD` |
| Evidence attachments | `TBD` |

## Regra de bloqueio

A ausência de **qualquer** aprovação bloqueante mantém:
- `ADR-0001 status = PROPOSED`
- `ARDEN_PRD_001_2B_ENTRY_GATE = FAIL`

Aprovações bloqueantes: Selected alternative, Selected region, Approved budgets (3),
Approved RPO/RTO, `Legal status = APPROVED`, `Security status = APPROVED`, os quatro
aprovadores (Business/Legal/Technical/Operations), e Evidence attachments (cotação + DPA).

## Vínculos

- Decisões: `INFRASTRUCTURE_BUSINESS_DECISION_FORM.md`
- Jurídico: `INFRASTRUCTURE_LEGAL_REVIEW_CHECKLIST.md` + `INFRASTRUCTURE_DATA_RESIDENCY_QUESTIONNAIRE.md`
- SLA/suporte: `INFRASTRUCTURE_SLA_SUPPORT_CHECKLIST.md`
- Custo: `INFRASTRUCTURE_QUOTE_TEMPLATE.md` + `INFRASTRUCTURE_COST_COMPARISON_TEMPLATE.md`
- Aprovadores: `INFRASTRUCTURE_APPROVAL_RACI.md`
- Checklist de aprovação da ADR: `docs/decisions/ADR-0001-APPROVAL-CHECKLIST.md`
