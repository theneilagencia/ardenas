<!-- Milestone: ARDEN-PRD-001.2A.1 -->
# ARDEN-PRD-001.2A.1 — Formulário de decisão de infraestrutura

Formulário **a ser preenchido** por negócio + jurídico + responsável técnico. Nenhum
campo pode ser resolvido por inferência. Finalistas: **B (GCP)**, **D (PaaS)**, **A (AWS)**.
Enquanto qualquer campo bloqueante estiver `TBD`, o `ARDEN_PRD_001_2B_ENTRY_GATE` = **FAIL**
e o `ADR-0001` permanece **PROPOSED**.

## Estados permitidos por campo
`TBD` · valor explícito · `REQUIRES_QUOTE` · `REQUIRES_LEGAL_REVIEW` · `NOT_APPLICABLE`.
Um campo **bloqueante** só sai de `TBD` com evidência anexada (cotação/parecer/contrato).

## Decisões obrigatórias (20)

| # | Decisão | Valor (preencher) | Bloqueante? | Evidência exigida |
| --- | --- | --- | --- | --- |
| 1 | Arquitetura aprovada (A/B/D) | `TBD` | Sim | Matriz comparativa + cotação |
| 2 | Região primária | `TBD` | Sim | Parecer de residência (S8) |
| 3 | Região de recuperação | `TBD` | Sim | Parecer de residência (S8) |
| 4 | Orçamento mensal de staging | `TBD` | Sim | Cotação oficial |
| 5 | Orçamento mensal de piloto | `TBD` | Sim | Cotação oficial |
| 6 | Orçamento mensal de produção inicial | `TBD` | Sim | Cotação oficial |
| 7 | Nível de suporte contratado | `TBD` | Sim | Contrato/proposta |
| 8 | SLA mínimo aceito | `TBD` | Sim | SLA contratual |
| 9 | RPO aprovado | `TBD` | Sim | Confirmação técnica + drill |
| 10 | RTO aprovado | `TBD` | Sim | Confirmação técnica + drill |
| 11 | Residência de dados permitida | `TBD` | Sim | Parecer jurídico |
| 12 | Jurisdições proibidas | `TBD` | Sim | Parecer jurídico |
| 13 | Subprocessadores aceitos | `TBD` | Sim | Lista + DPA aprovado |
| 14 | Apetite de lock-in | `TBD` | Sim | Decisão estratégica registrada |
| 15 | Prioridade velocidade × portabilidade | `TBD` | Sim | Decisão estratégica registrada |
| 16 | Secret manager aprovado | `TBD` | Sim | Consequência de #1 + questionário |
| 17 | PostgreSQL aprovado | `TBD` | Sim | Questionário ao fornecedor |
| 18 | Compute aprovado | `TBD` | Sim | Questionário ao fornecedor |
| 19 | Observabilidade aprovada | `TBD` | Sim | Proposta/plano |
| 20 | Responsáveis operacionais | `TBD` | Sim | Cargo atribuído (RACI) |

## Regra de consistência

- #16–#18 devem ser **coerentes** com #1 (a arquitetura escolhida determina o conjunto).
- #2/#3/#11/#12/#13 são interdependentes e dependem de **parecer jurídico** (não técnico).
- #8/#9/#10 não podem ser preenchidos sem **contrato de SLA** e medição de drill.

## Assinatura de submissão (preencher)

| Papel | Nome/Cargo | Data (UTC) | Assinatura/registro |
| --- | --- | --- | --- |
| Negócio | `TBD` | `TBD` | `TBD` |
| Jurídico | `TBD` | `TBD` | `TBD` |
| Responsável técnico | `TBD` | `TBD` | `TBD` |

> Este formulário **não** seleciona fornecedor nem preenche preço/SLA. Ele apenas coleta a
> decisão humana. A seleção efetiva é registrada em
> `INFRASTRUCTURE_DECISION_RECORD_TEMPLATE.md` e refletida no `ADR-0001` apenas quando
> todos os pré-requisitos do `ADR-0001-APPROVAL-CHECKLIST.md` estiverem satisfeitos.
