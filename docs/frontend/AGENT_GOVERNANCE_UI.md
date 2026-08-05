# UI de governança de agentes (ARDEN-BE-007.7)

A governança de um resultado operacional é **surfaceada** a partir da API, nunca
recomputada no cliente. O `AgentGovernanceBadge` apenas exibe o `governanceStatus` que o
servidor calculou.

## Status de governança (do servidor)

| Status | Significado |
| --- | --- |
| `WITHIN_LIMITS` | dentro dos limites configurados |
| `LIMIT_WARNING` | próximo de um teto (alerta) |
| `LIMIT_EXCEEDED` | teto ultrapassado |
| `BLOCKED` | bloqueado por sinal crítico / política |

O status aparece na lista e no detalhe de resultados (`AGENT_RESULTS_UI.md`) e é a decisão
do `AgentGovernanceEvaluator` do backend (BE-007.6).

## Limites observados vs configurados

- **Configurados**: tetos definidos na versão do agente (política de custo/execução, ver
  `AGENT_VERSION_EDITOR.md`) — o que o usuário edita.
- **Observados**: usage/custo reais da execução — o que o servidor mediu.

A comparação (observado × configurado) que produz o status é feita **no backend**. O
frontend nunca reavalia limites nem deriva o status a partir dos números observados — isso
evitaria divergência com a decisão oficial e com a auditoria.

## Nunca recomputado no cliente

Assim como custo e avaliação, governança chega pronta. O cliente não conhece as fórmulas de
limite; só apresenta o veredito e os valores oficiais.
