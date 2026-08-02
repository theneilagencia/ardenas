# Usage e custo do runtime (ARDEN-BE-007.3 §19/§20)

`AgentUsage` agregado sobre TODAS as chamadas (incluindo repairs): `inputTokens`/
`outputTokens` somados; `modelCallCount` = nº de gerações; `toolCallCount=0`;
`cachedInput/OutputTokens=0`; `durationMs` somado. `estimatedCostMinor=null` e
`currency=null` — **custo permanece nulo nesta fase** (sem tabela de preços; enforcement
monetário real adiado para 007.6). Token count é estimativa determinística
`ceil(bytesUTF8/4)`, usada só para enforcement de limites e usage do provider de teste — não
equivale exatamente a providers comerciais. `maximumEstimatedCostMinor`, quando configurado,
NÃO bloqueia (documentado, adiado). Persistência específica de usage (AgentModelCall) fica
para 007.6; nesta fase usage vive na evidência da etapa.
