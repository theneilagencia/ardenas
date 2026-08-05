<!-- Milestone: ARDEN-PRD-001.2A.1 -->
# ARDEN-PRD-001.2B — Entry gate (verificação documental)

Verificação documental que autoriza (ou bloqueia) o início do **ARDEN-PRD-001.2B**.
Resultado: `PASS` ou `FAIL`.

## Resultado atual

**`ARDEN_PRD_001_2B_ENTRY_GATE = FAIL`**

Motivo: a decisão de negócio ainda não foi tomada nem registrada; `ADR-0001` = `PROPOSED`.

## Condições de PASS (todas obrigatórias)

| # | Condição | Estado atual | Fonte |
| --- | --- | --- | --- |
| 1 | `ADR-0001 = ACCEPTED` | ❌ PROPOSED | `docs/decisions/ADR-0001-PRODUCTION-INFRASTRUCTURE.md` |
| 2 | Selected architecture != null | ❌ TBD | `INFRASTRUCTURE_DECISION_RECORD_TEMPLATE.md` |
| 3 | Selected region != null | ❌ TBD | `INFRASTRUCTURE_DATA_RESIDENCY_QUESTIONNAIRE.md` |
| 4 | Official quote attached | ❌ ausente | `INFRASTRUCTURE_QUOTE_TEMPLATE.md` |
| 5 | Legal approval attached | ❌ NOT_REVIEWED | `INFRASTRUCTURE_LEGAL_REVIEW_CHECKLIST.md` |
| 6 | RPO/RTO approved | ❌ TBD | `INFRASTRUCTURE_SLA_SUPPORT_CHECKLIST.md` |
| 7 | Operations owner assigned | ❌ TBD | `INFRASTRUCTURE_APPROVAL_RACI.md` |

## Regra

- `PASS` **somente** quando as 7 condições forem verdadeiras.
- Enquanto **qualquer** condição faltar → `FAIL` e **ARDEN-PRD-001.2B não inicia**.
- Este gate é **documental**: não cria recursos, não seleciona fornecedor, não altera a ADR.
- Ao virar `PASS`, registrar a data (UTC) e a referência ao registro de decisão que o
  satisfez; então 001.2B pode iniciar pela fase 001.2B.1 (`INFRASTRUCTURE_IMPLEMENTATION_PLAN.md`).

## Invariantes mantidos independentemente do resultado

- Anthropic **DISABLED**; `productionAllowed=false`.
- Nenhum secret no repositório; master key nunca no banco; sem endpoint HTTP de secrets.
