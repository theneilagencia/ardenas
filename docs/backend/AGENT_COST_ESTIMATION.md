# Agent cost estimation (ARDEN-BE-007.6)

Custo é ESTIMADO de forma determinística — NÃO é billing, invoice, wallet ou preço comercial
real. `AgentCostEstimator.estimate(usage, rate | null)` é PURO e usa apenas inteiros.

## Fórmula (por componente, unidade menor)

```
componente = ceil(tokens × ratePerMillion / 1_000_000)   // BigInt, ceilDiv
custo = input + output + cachedInput + cachedOutput
```

`ratePerMillion` = custo na unidade menor (ex.: cents) por MILHÃO de tokens, vindo da rate
card ativa (`AGENT_MODEL_RATE_CARDS.md`). Toda a aritmética é BigInt; nada de ponto flutuante
em dinheiro (FAIL da spec).

## Rate card ausente vs. zero

| Situação | `estimatedCostMinor` | `currency` | `warningCode` |
| --- | --- | --- | --- |
| Rate card ATIVA encontrada | inteiro ≥ 0 | da card | `null` |
| Rate card com custo 0 (ex.: `internal.test-model`) | `0` | da card | `null` |
| Rate card AUSENTE | `null` | `null` | `COST_RATE_CARD_NOT_AVAILABLE` |

Custo ausente **nunca** é tratado como zero — é `null` + warning. Custo zero conhecido é `0`
com currency. Ao ausente, o recorder emite o evento `agent.cost_rate_card_missing`.

## Agregação

Custo do result = soma dos custos por chamada de modelo (cada uma com ceil próprio). Se não
houver rate card, o result inteiro fica com custo `null`. `internal.test-model` = 0 USD em
todos os modelIds determinísticos.
