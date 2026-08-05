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

## 3. Preços — UNVERIFIED (re-confirmado no gate 008.2A)

Nenhum preço é autoritativo. No gate 008.2A (2026-08-03) as páginas oficiais de pricing
(`docs.anthropic.com/.../pricing`, `www.anthropic.com/pricing`) foram tentadas de novo e
retornaram **403 (Cloudflare)** — ver `../implementation/ARDEN_BE_008_EXTERNAL_VERIFICATION_GATE.md`.
**PRICING_STATUS = UNVERIFIED.** Portanto:

- os campos de custo ficam **vazios/UNVERIFIED** — não bakear preço de memória nem por família;
- o **catálogo persistido de rate cards Anthropic permanece VAZIO** (nenhuma linha em
  `model_rate_cards` para `anthropic.direct`); nenhum placeholder `0 USD`;
- serão preenchidos em fase futura, após leitura direta da tabela oficial, com `sourceUrl` +
  `sourceAccessedAt` + vigência + `catalogHash` registrados;
- `currency` também só é fixada na leitura direta.

## 4. Resolução e ausência

`ModelRateCardsRepository.findActive(providerKey, providerVersion, modelId)` → card `ACTIVE`
ou `null`. Card ausente → custo `null` + `COST_RATE_CARD_NOT_AVAILABLE`. **Nunca 0**: 0 é
custo conhecido igual a zero; ausência de preço verificado é `null`. Como não há preço nesta
fase, todo modelo Anthropic resolve para `null` (catálogo incompleto sinalizado, execução
não bloqueada — mas o provider já está `DISABLED`).

## 5. Atualização 008.4 — ainda vazio (pricing UNVERIFIED)

O gate 008.4A (2026-08-03) reconfirmou **PRICING_STATUS = UNVERIFIED** (0 documentos oficiais
recebidos; páginas de pricing **403 reconfirmado**). **Nenhum rate card foi criado**; o catálogo
de rate cards Anthropic permanece **VAZIO**. Mesmo no smoke test real (não executado), o custo
seria `estimatedCostMinor=null` / `currency=null` com usage real, sinalizado por
`COST_RATE_CARD_NOT_AVAILABLE` — nunca um valor monetário estimado. Ver
`ANTHROPIC_NON_PROD_QUOTAS.md` (contenção por tokens/chamadas, sem moeda) e
`ANTHROPIC_LIVE_TEST_EVIDENCE_MODEL.md`.
