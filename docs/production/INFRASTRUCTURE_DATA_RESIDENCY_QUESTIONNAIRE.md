<!-- Milestone: ARDEN-PRD-001.2A.1 -->
# ARDEN-PRD-001.2A.1 — Questionário de residência de dados

Para preenchimento conjunto **negócio + jurídico**. Este documento **não declara**
residência de dados atendida nem escolhe região — apenas coleta a decisão. Enquanto não
respondido e aprovado pelo jurídico, os campos 2/3/11/12/13 do formulário de decisão
permanecem `TBD` e o entry gate = FAIL.

## Perguntas

| # | Pergunta | Resposta | Aprovado por (jurídico) |
| --- | --- | --- | --- |
| 1 | Região primária permitida | `TBD` | `NOT_REVIEWED` |
| 2 | Região de recuperação permitida | `TBD` | `NOT_REVIEWED` |
| 3 | Regiões/jurisdições **proibidas** | `TBD` | `NOT_REVIEWED` |
| 4 | Dados podem sair da jurisdição primária? | `TBD` | `NOT_REVIEWED` |
| 5 | Mecanismo de transferência internacional aceito | `TBD` | `NOT_REVIEWED` |
| 6 | Cópia de backup inter-região permitida? | `TBD` | `NOT_REVIEWED` |
| 7 | Subprocessadores aceitos (lista) | `TBD` | `NOT_REVIEWED` |
| 8 | Requisitos setoriais/regulatórios adicionais | `TBD` | `NOT_REVIEWED` |
| 9 | Classificação dos dados armazenados (credenciais de terceiros, PII) | `TBD` | `NOT_REVIEWED` |
| 10 | Base legal para armazenar credenciais de terceiros | `TBD` | `NOT_REVIEWED` |

## Estados de aprovação (coluna jurídico)
`APPROVED` · `REJECTED` · `REQUIRES_CLARIFICATION` · `NOT_REVIEWED` · `NOT_APPLICABLE`.
Somente jurídico marca `APPROVED`.

## Vínculo com decisão

- As respostas 1–3 preenchem os campos **#2/#3/#11/#12** do
  `INFRASTRUCTURE_BUSINESS_DECISION_FORM.md`.
- A resposta 7 preenche **#13** (subprocessadores aceitos) e depende do DPA
  (`INFRASTRUCTURE_LEGAL_REVIEW_CHECKLIST.md`).
- **Nenhuma região é escolhida por inferência.** Sem `APPROVED` do jurídico, residência de
  dados = **não atendida**.
- Referência: S8 do `ARDEN_PRD_001_2A_SOURCE_REGISTER.md`; classificação de dados em
  `docs/production/DATA_CLASSIFICATION_AND_RETENTION.md`.
