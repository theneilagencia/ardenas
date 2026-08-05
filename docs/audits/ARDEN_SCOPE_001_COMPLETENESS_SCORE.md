<!-- Milestone: ARDEN-SCOPE-001 -->
# ARDEN-SCOPE-001 — Modelo de pontuação e percentuais

Recalculável a partir de `arden-scope-001-requirements.json` + `arden-scope-001-scores.json`
(gerados deterministicamente). Commit `756b244`.

## Pesos (§18)
COMPLETE=1.00 · PARTIAL=0.50 · PREPARED=0.35 · DOCUMENTED_ONLY=0.20 · MOCK_ONLY=0.20 ·
TEST_ONLY=0.20 · DISABLED=0.25 · MISSING=0.00 · UNVERIFIED=0.00 ·
BLOCKED_BY_DECISION=0.00 · BLOCKED_BY_EXTERNAL_PROVIDER=0.00 · NOT_APPLICABLE/SUPERSEDED/DUPLICATE=excluído.

## Números absolutos (105 requisitos)
| Status | Qtd |
| --- | --- |
| COMPLETE | 76 |
| PARTIAL | 3 |
| PREPARED | 6 |
| DOCUMENTED_ONLY | 1 |
| MOCK_ONLY | 8 |
| TEST_ONLY | 0 |
| DISABLED | 0 |
| MISSING | 0 |
| UNVERIFIED | 0 |
| BLOCKED_BY_DECISION | 9 |
| BLOCKED_BY_EXTERNAL_PROVIDER | 2 |
| NOT_APPLICABLE / SUPERSEDED / DUPLICATE | 0 |
| **Total** | **105** (100 obrigatórios, 5 opcionais) |

## Métricas gerais
- **IMPLEMENTATION_COMPLETENESS = 86,6%** — média ponderada sobre os requisitos
  *desenvolvíveis* (exclui os 11 bloqueados por decisão/provedor externo; exclui NA/SUPERSEDED/DUPLICATE).
- **APPROVED_SCOPE_READINESS = 77,5%** — média ponderada sobre **todo** o escopo aprovado
  (os 11 bloqueados contam como 0,00).
- **FUNCTIONAL_SCOPE_COMPLETENESS = 89,9%** — domínios funcionais A–V (exclui W/X).

## Sub-scores por camada
| Camada | Score | n |
| --- | --- | --- |
| FRONTEND | 71,0% | 10 |
| BACKEND | 89,3% | 27 |
| API | 100,0% | 3 |
| DATABASE | 83,3% | 3 |
| EXECUTION_ENGINE | 86,7% | 6 |
| CONNECTOR | 100,0% | 8 |
| AGENT_AI | 93,3% | 15 |
| SECURITY_GOVERNANCE | 95,0% | 16 |
| OPERATIONAL | 19,2% | 12 |
| PRODUCTION | 0,0% | 5 |

## Como recomputar
`python3` sobre `arden-scope-001-requirements.json`: para cada métrica, filtrar o pool
indicado, somar `peso[status]` e dividir pelo tamanho do pool. Os totais desta página, da
matriz de rastreabilidade (`arden-scope-001-traceability.csv`, 105 linhas) e do JSON
coincidem por construção (um único gerador).
