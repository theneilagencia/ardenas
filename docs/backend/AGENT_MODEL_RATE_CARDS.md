# Model rate cards (ARDEN-BE-007.6)

`model_rate_cards`: catálogo SYSTEM-MANAGED de tabelas de preço estimado por modelo. Não é
preço comercial real; serve só à estimativa determinística (`AGENT_COST_ESTIMATION.md`).

## Modelo

Unique `(provider_key, provider_version, model_id, status)`. Custos em unidade menor por
MILHÃO de tokens: `input_cost_per_million_tokens_minor`, `output_...`,
`cached_input_...`, `cached_output_...`, `currency`, `source`, `catalog_hash`, `status`
(`ACTIVE`/`RETIRED`).

## Projeção idempotente

Fonte canônica: `src/contracts/agents/model-rate-card-catalog.ts` (`MODEL_RATE_CARDS`).
`runRateCardProjection` faz upsert por `catalog_hash` — reexecução não duplica nem altera
linhas inalteradas. Rodada no `seed` (`db:seed`) e exposta como `RateCardCatalogProjector`
(usada também nos testes de integração).

`internal.test-model@1` tem card para os 19 modelIds determinísticos, TODOS 0 USD (custo zero
CONHECIDO, nunca `null`). Rate cards comerciais reais chegam com o provider real (fase
futura), sem internet neste milestone.

## Resolução

`ModelRateCardsRepository.findActive(providerKey, providerVersion, modelId)` devolve a card
`ACTIVE` ou `null`. `null` → custo `null` + `COST_RATE_CARD_NOT_AVAILABLE`.
