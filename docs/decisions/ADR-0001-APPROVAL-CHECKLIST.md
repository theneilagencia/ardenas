# ADR-0001 — Checklist de aprovação (para mover PROPOSED → ACCEPTED)

- **Milestone:** ARDEN-PRD-001.2A.1
- **ADR alvo:** `docs/decisions/ADR-0001-PRODUCTION-INFRASTRUCTURE.md`
- **Estado atual da ADR:** `PROPOSED` (não alterar sem os itens abaixo satisfeitos)

> Este checklist **não** aprova nada. Ele lista as pré-condições objetivas para que uma
> pessoa autorizada mova a ADR para `ACCEPTED`. **Nenhum item pode ser marcado como
> cumprido por inferência.**

## Pré-condições (todas obrigatórias)

| # | Pré-condição | Cumprida? | Evidência (referência) |
| --- | --- | --- | --- |
| 1 | Alternativa selecionada (A/B/D) | ❌ | `INFRASTRUCTURE_DECISION_RECORD_TEMPLATE.md` |
| 2 | Região selecionada | ❌ | `INFRASTRUCTURE_DATA_RESIDENCY_QUESTIONNAIRE.md` |
| 3 | Cotação oficial anexada | ❌ | `INFRASTRUCTURE_QUOTE_TEMPLATE.md` |
| 4 | Orçamento aprovado (staging/piloto/produção) | ❌ | `INFRASTRUCTURE_BUSINESS_DECISION_FORM.md` |
| 5 | SLA confirmado (contrato) | ❌ | `INFRASTRUCTURE_SLA_SUPPORT_CHECKLIST.md` |
| 6 | Jurídico aprovado | ❌ | `INFRASTRUCTURE_LEGAL_REVIEW_CHECKLIST.md` |
| 7 | DPA aprovado ou formalmente dispensado | ❌ | `INFRASTRUCTURE_LEGAL_REVIEW_CHECKLIST.md` |
| 8 | RPO/RTO aprovados | ❌ | `INFRASTRUCTURE_SLA_SUPPORT_CHECKLIST.md` |
| 9 | Responsável operacional atribuído | ❌ | `INFRASTRUCTURE_APPROVAL_RACI.md` |
| 10 | Riscos aceitos | ❌ | `ARDEN_PRD_001_2A_RISK_ASSESSMENT.md` |
| 11 | Aprovadores registrados | ❌ | `INFRASTRUCTURE_DECISION_RECORD_TEMPLATE.md` |

## Registro exigido ao mover para ACCEPTED

Ao (e somente ao) satisfazer todos os itens, registrar **no próprio ADR** (sem reescrever
o histórico):
- `approval date` (UTC)
- `approvers` (cargos/nomes)
- `evidence references` (links aos documentos acima)
- `decision conditions`
- `review date`

## Estado

Enquanto qualquer linha estiver `❌`, a ADR permanece **PROPOSED** e o
`ARDEN_PRD_001_2B_ENTRY_GATE` = **FAIL**. Nesta fase, **todas** as linhas estão `❌`.
