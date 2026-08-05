<!-- Milestone: ARDEN-PRD-001.2A.1 -->
# ARDEN-PRD-001.2A.1 — Relatório do pacote executivo de decisão

Transforma os gaps de 001.2A em **perguntas objetivas, evidências exigidas e campos de
aprovação**, para que negócio, jurídico e responsável técnico decidam e **registrem** a
decisão que destrava o ARDEN-PRD-001.2B. **Fase documental** — nada selecionado, nada
preenchido, ADR permanece PROPOSED.

## Componentes do pacote

| Componente | Documento |
| --- | --- |
| Formulário de decisão (20 decisões) | `docs/production/INFRASTRUCTURE_BUSINESS_DECISION_FORM.md` |
| Modelo de cotação (3 finalistas × 3 cenários) | `docs/production/INFRASTRUCTURE_QUOTE_TEMPLATE.md` |
| Matriz comparável de custos | `docs/production/INFRASTRUCTURE_COST_COMPARISON_TEMPLATE.md` |
| Questionário ao fornecedor | `docs/production/INFRASTRUCTURE_VENDOR_QUESTIONNAIRE.md` |
| Checklist jurídico | `docs/production/INFRASTRUCTURE_LEGAL_REVIEW_CHECKLIST.md` |
| Questionário de residência de dados | `docs/production/INFRASTRUCTURE_DATA_RESIDENCY_QUESTIONNAIRE.md` |
| Checklist de SLA e suporte | `docs/production/INFRASTRUCTURE_SLA_SUPPORT_CHECKLIST.md` |
| Matriz lock-in × velocidade | `docs/production/INFRASTRUCTURE_LOCK_IN_VELOCITY_MATRIX.md` |
| RACI de aprovação | `docs/production/INFRASTRUCTURE_APPROVAL_RACI.md` |
| Registro de decisão | `docs/production/INFRASTRUCTURE_DECISION_RECORD_TEMPLATE.md` |
| Entry gate 001.2B | `docs/production/ARDEN_PRD_001_2B_ENTRY_GATE.md` |
| Checklist de aprovação da ADR | `docs/decisions/ADR-0001-APPROVAL-CHECKLIST.md` |

## Critérios eliminatórios (binários)

Uma alternativa é **eliminada** se não **comprovar** (comprovação = evidência oficial
direta ou contrato; `PARTIALLY_VERIFIED` **não** conta):

PostgreSQL gerenciado · HA compatível com o alvo · PITR · restore para ambiente isolado ·
private networking (ou isolamento equivalente) · TLS · secret manager (ou integração
segura equivalente) · workload identity · logs externos · alertas externos · separação
staging/production · imagem imutável por SHA · rollback · egress control compatível · DPA
aceitável · residência de dados aceitável · SLA contratado aceitável · custo dentro do
orçamento aprovado.

> Nesta fase, as capacidades estão `PARTIALLY_VERIFIED` (fetch bloqueado no ambiente) e
> custo/SLA/jurídico não confirmados → **nenhuma** alternativa está comprovada como aprovada,
> e **nenhuma** é eliminada. A comprovação ocorre com o pacote preenchido.

## Regra de decisão

- Preencher os documentos acima com **evidência** (cotação/parecer/contrato).
- Registrar a decisão em `INFRASTRUCTURE_DECISION_RECORD_TEMPLATE.md`.
- Satisfazer `ADR-0001-APPROVAL-CHECKLIST.md` → mover a ADR para `ACCEPTED` (registro no
  próprio ADR, sem reescrever histórico).
- `ARDEN_PRD_001_2B_ENTRY_GATE` vira `PASS` → 001.2B inicia.
- Enquanto isso não ocorrer: entry gate = **FAIL**, ADR = **PROPOSED**, 001.2B **bloqueado**.

## Validação documental (auto-checagem)

| Verificação | Resultado |
| --- | --- |
| Nenhum campo crítico pré-preenchido | OK (todos `TBD`/`NOT_REVIEWED`/`REQUIRES_QUOTE`) |
| Nenhum preço inventado | OK (`REQUIRES_QUOTE`/`REQUIRES_SALES_CONFIRMATION`) |
| Nenhuma aprovação inventada | OK (`NOT_REVIEWED`) |
| Nenhuma pessoa inventada | OK (cargos/`TBD`) |
| No máximo três finalistas | OK (A/B/D) |
| Estados padronizados | OK (vocabulário fixo por documento) |
| ADR e entry gate consistentes | OK (ambos bloqueiam: PROPOSED / FAIL) |
| Documentos sem contradição | OK (referências cruzadas coerentes) |
| 001.2B permanece bloqueado | OK (entry gate = FAIL) |

## Estado

`STATUS ARDEN-PRD-001.2A.1: PASS` (pacote completo; nenhuma decisão/preço/aprovador
inventado; ADR PROPOSED; 001.2B bloqueado). Detalhe na saída final da execução.
