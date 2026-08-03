# Persistência de rate cards Anthropic (ARDEN-BE-008.2)

> Rate cards reusam `model_rate_cards` (BigInt, unidades menores por milhão de tokens).
> Para `anthropic.direct` o catálogo persistido é **VAZIO**: o preço é UNVERIFIED.

## 1. Estado nesta fase: catálogo vazio

Gate 008.2A: `docs.anthropic.com/pricing` retornou **403** em fetch automatizado. Sem
fonte oficial legível, **nenhum rate card é gravado** para o Anthropic. A tabela
`model_rate_cards` continua existindo (BE-007), apenas sem entradas do provider.

## 2. Regra: ausência ≠ zero

Custo desconhecido é a **ausência** de rate card, **nunca** um placeholder de 0 USD:

```
custo não resolvível  ⇒  cost = null  +  COST_RATE_CARD_NOT_AVAILABLE
                      (jamais 0)
```

Um `0` seria uma afirmação falsa de "grátis". A ausência é honesta: "preço
desconhecido". Consumidores tratam `null`/código canônico, nunca zero.

## 3. Precisão (já suficiente)

Valores são `BigInt` em **unidades menores por milhão de tokens** (cents-per-million).
Essa precisão já basta para preços da Anthropic — **nenhuma mudança no modelo de custo**
é necessária quando o preço for verificado.

## 4. Forma futura (quando VERIFIED)

Quando o preço for oficialmente verificado, persistir com:

```
{ providerKey, modelId (exato),
  currency, unit, values (inteiros),
  effectiveFrom, effectiveUntil,
  sourceUrl, sourceAccessedAt,
  catalogHash, status }
```

- `modelId` deve ser o snapshot datado exato (não alias);
- `sourceUrl` + `sourceAccessedAt` registram a proveniência oficial;
- `effectiveFrom/Until` versionam a vigência do preço.

## 5. NUNCA

- gravar `0` como preço "provisório";
- inventar preço a partir de memória, resumo de busca ou família;
- resolver custo sem rate card correspondente.
