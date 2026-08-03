# UI de uso e custo de agentes (ARDEN-BE-007.7)

`AgentUsagePage.tsx` — rollups de uso/custo por dimensão. **Somente leitura.**

## Agregação vem da API, nunca do browser

`useAgentUsage({ groupBy })` → `GET …/agent-usage` (rollups oficiais). O frontend
**nunca** agrega no browser a partir de páginas incompletas de resultados nem recalcula
custo — cada bucket já traz os totais e o custo oficial (unidade menor inteira).

Dimensões de `groupBy`: `ORGANIZATION`, `OPERATION`, `AGENT_DEFINITION`, `AGENT_VERSION`,
`MODEL_CONFIGURATION`, `PROVIDER`, `MODEL`. Colunas: dimensão, período, provider, modelo,
execuções, sucesso, falha, tokens, custo total.

## Custo conhecido-zero vs indisponível

Distinção crítica preservada por `formatMinorCost` (`agent-format.ts`):

- `estimatedCostMinor == null` ou `currency == null` → **"Custo não disponível"** (rate
  card ausente). Nunca vira "0,00".
- Zero **conhecido** (inteiro `0`, ex.: provider interno) → formatado normalmente como
  `0,00` da moeda.

A conversão para unidade maior é **só para exibição**; o valor de domínio permanece inteiro
em unidade menor.

## Custo é estimado, não faturamento

O custo é sempre **estimado** (rate cards internas versionadas), não billing/invoice/
wallet/payment. Permissão de leitura de custo: `agent.cost.view`. Não há qualquer
superfície de cobrança no frontend.
