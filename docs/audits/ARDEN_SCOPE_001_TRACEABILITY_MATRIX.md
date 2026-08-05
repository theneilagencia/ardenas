<!-- Milestone: ARDEN-SCOPE-001 -->
# ARDEN-SCOPE-001 — Matriz de rastreabilidade

Uma linha por requisito (105) mapeando requisito → implementação → teste. Fonte canônica
recomputável: **`arden-scope-001-traceability.csv`** (105 linhas; colunas scopeId, domain,
domainName, category, feature, mandatory, layers, status, evidence) e
`arden-scope-001-requirements.json` (com referência de arquivo/símbolo/teste).

## Resumo por status
| Status | Qtd | Peso |
| --- | --- | --- |
| COMPLETE | 76 | 1.00 |
| PARTIAL | 3 | 0.50 |
| PREPARED | 6 | 0.35 |
| DOCUMENTED_ONLY | 1 | 0.20 |
| MOCK_ONLY | 8 | 0.20 |
| BLOCKED_BY_DECISION | 9 | 0.00 |
| BLOCKED_BY_EXTERNAL_PROVIDER | 2 | 0.00 |
| **Total** | **105** | — |

Nenhum requisito `COMPLETE` sem evidência de todas as camadas obrigatórias (regra §7). Os
totais coincidem com `ARDEN_SCOPE_001_COMPLETENESS_SCORE.md` e `arden-scope-001-scores.json`
(gerador único). Exemplos de rastreamento por camada estão nos coverage docs específicos
(backend/frontend/api/database/execution/connector/agent/security).
