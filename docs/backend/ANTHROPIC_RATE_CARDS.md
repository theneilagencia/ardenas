# Rate cards Anthropic (ARDEN-BE-008.1)

> Contrato apenas. **Nenhum preço é gravado nesta fase** — preços PENDING_DIRECT (docs de
> pricing sob Cloudflare 403). Sem mudança de schema vs. BE-007.6. Provider `anthropic.direct`
> v`1`. Fonte de fatos: `ANTHROPIC_OFFICIAL_SOURCE_REGISTER.md`.

## 1. Shape do rate card (reusa `model_rate_cards`, BE-007.6)

Por `(providerKey, providerVersion, modelId)`, valores em **unidade menor (centavos) por
MILHÃO de tokens**, `BigInt`:

```
{
  inputCostPerMillionMinor:            BigInt,   // tokens de entrada
  outputCostPerMillionMinor:           BigInt,   // tokens de saída
  cachedInputWriteCostPerMillionMinor: BigInt,   // escrita de cache (cache_creation_input_tokens)
  cachedInputReadCostPerMillionMinor:  BigInt,   // leitura de cache (cache_read_input_tokens)
  currency:      'USD',                          // UNVERIFIED até leitura direta
  effectiveFrom: <date>,
  effectiveUntil:<date|null>,
  sourceUrl:     '<página oficial de pricing>',
  sourceAccessedAt: <date>,
  catalogHash:   '<sha-256 canônico>',
}
```

Escrita e leitura de cache têm **taxas distintas** — justificado pelos campos de usage
VERIFIED `cache_creation_input_tokens` (escrita) vs. `cache_read_input_tokens` (leitura).

## 2. Análise de precisão (sem mudança de contrato)

Os preços atuais da Anthropic têm granularidade de **centavos inteiros** por milhão de
tokens. Centavos-por-milhão (`BigInt`, minor units do BE-007.6) já representam isso sem
perda — **não há necessidade de alterar o contrato de unidade** (nada de micro-unidades ou
decimais). Mantém-se o padrão `model_rate_cards` existente.

## 3. Preços — UNVERIFIED nesta fase (PENDING_DIRECT)

Nenhum preço é autoritativo agora: a busca restrita a `anthropic.com` retornou a página de
pricing mas **não pôde ser lida diretamente** (403), e o resumo misturou o mapeamento por
família. Portanto:

- os campos de custo ficam **vazios/UNVERIFIED** — não baker preço de memória;
- serão preenchidos em **008.2**, após leitura direta da tabela oficial, com `sourceUrl` +
  `sourceAccessedAt` registrados;
- `currency` também confirmada na leitura direta.

## 4. Resolução e ausência

`ModelRateCardsRepository.findActive(providerKey, providerVersion, modelId)` → card `ACTIVE`
ou `null`. Card ausente → custo `null` + `COST_RATE_CARD_NOT_AVAILABLE`. **Nunca 0**: 0 é
custo conhecido igual a zero; ausência de preço verificado é `null`. Como não há preço nesta
fase, todo modelo Anthropic resolve para `null` (catálogo incompleto sinalizado, execução
não bloqueada — mas o provider já está `DISABLED`).
