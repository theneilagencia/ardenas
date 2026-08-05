<!-- Milestone: ARDEN-PRD-001.2A.1 -->
# ARDEN-PRD-001.2A.1 — Checklist de revisão jurídica

Para revisão pelo **jurídico**. Este documento **não emite parecer jurídico** — apenas
estrutura a revisão. **Somente o jurídico** pode marcar `APPROVED`. Uma cópia por
finalista (A/B/D).

Fornecedor: `TBD` · Revisor jurídico (cargo): `TBD` · Data (UTC): `TBD`

## Estados permitidos
`APPROVED` · `REJECTED` · `REQUIRES_CLARIFICATION` · `NOT_REVIEWED` · `NOT_APPLICABLE`

## Itens

| # | Item | Estado | Evidência/Observação |
| --- | --- | --- | --- |
| 1 | DPA disponível | NOT_REVIEWED | `TBD` |
| 2 | DPA aprovado | NOT_REVIEWED | `TBD` |
| 3 | Controlador/processador definidos | NOT_REVIEWED | `TBD` |
| 4 | Subprocessadores listados | NOT_REVIEWED | `TBD` |
| 5 | Aviso prévio de mudança de subprocessador | NOT_REVIEWED | `TBD` |
| 6 | Regiões de processamento | NOT_REVIEWED | `TBD` |
| 7 | Regiões de armazenamento | NOT_REVIEWED | `TBD` |
| 8 | Transferência internacional | NOT_REVIEWED | `TBD` |
| 9 | Cláusulas contratuais (SCC/equivalente) | NOT_REVIEWED | `TBD` |
| 10 | LGPD | NOT_REVIEWED | `TBD` |
| 11 | GDPR | NOT_REVIEWED | `TBD` |
| 12 | Exclusão de dados | NOT_REVIEWED | `TBD` |
| 13 | Retenção | NOT_REVIEWED | `TBD` |
| 14 | Backups após exclusão | NOT_REVIEWED | `TBD` |
| 15 | Legal hold | NOT_REVIEWED | `TBD` |
| 16 | Auditoria | NOT_REVIEWED | `TBD` |
| 17 | Incidentes | NOT_REVIEWED | `TBD` |
| 18 | Notificação de violação | NOT_REVIEWED | `TBD` |
| 19 | Certificações | NOT_REVIEWED | `TBD` |
| 20 | Direito de rescisão | NOT_REVIEWED | `TBD` |
| 21 | Portabilidade e saída | NOT_REVIEWED | `TBD` |

## Regra de aprovação

- `Legal status = APPROVED` (no registro de decisão) exige **todos** os itens aplicáveis
  em `APPROVED` (ou `NOT_APPLICABLE` justificado). Qualquer `REJECTED` →
  arquitetura **eliminada** (ver `INFRASTRUCTURE_BUSINESS_DECISION_FORM.md` e critérios
  eliminatórios). Qualquer `REQUIRES_CLARIFICATION`/`NOT_REVIEWED` mantém o gate em FAIL.
- Referência de assunto: S8 do `ARDEN_PRD_001_2A_SOURCE_REGISTER.md` (REQUIRES_LEGAL_REVIEW).
