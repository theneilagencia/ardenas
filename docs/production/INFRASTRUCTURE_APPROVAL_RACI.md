<!-- Milestone: ARDEN-PRD-001.2A.1 -->
# ARDEN-PRD-001.2A.1 — Matriz RACI de aprovação

Responsabilidades por atividade. **Nomes não são inventados** — usar **cargo** ou `TBD`.
Convenção: **R** = Responsável (executa) · **A** = Aprovador (presta contas, único) · **C**
= Consultado · **I** = Informado.

## Matriz

| Atividade | Negócio | Jurídico | Tech Lead | Operações | Segurança |
| --- | --- | --- | --- | --- | --- |
| Aprovar orçamento | A | I | C | C | I |
| Aprovar fornecedor | A | C | C | C | C |
| Aprovar região | A | A | C | I | C |
| Aprovar DPA | C | A | I | I | C |
| Aprovar RPO/RTO | A | I | C | R | C |
| Criar contas | I | I | C | R | C |
| Configurar IAM | I | I | C | R | A |
| Executar restore drill | I | I | C | R | C |
| Autorizar produção | A | C | C | C | A |
| Break-glass | I | I | C | R | A |

## Atribuição de pessoas/cargos (preencher)

| Papel | Cargo/pessoa | Contato | Definido? |
| --- | --- | --- | --- |
| Negócio | `TBD` | `TBD` | Não |
| Jurídico | `TBD` | `TBD` | Não |
| Tech Lead | `TBD` | `TBD` | Não |
| Operações (owner) | `TBD` | `TBD` | Não |
| Segurança | `TBD` | `TBD` | Não |

## Regra

- "Autorizar produção" tem **dois** aprovadores (Negócio + Segurança) por ser gate final.
- "Configurar IAM", "Break-glass" têm Segurança como **A** (aprovador de segurança).
- Enquanto qualquer papel bloqueante (Operações owner, aprovadores) = `TBD`, o campo #20 do
  formulário e o registro de decisão permanecem incompletos → entry gate = FAIL.
- **Nenhum nome real é preenchido por inferência.**
