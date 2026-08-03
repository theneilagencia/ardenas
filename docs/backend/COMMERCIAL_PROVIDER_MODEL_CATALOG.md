# Catálogo de modelos do provider comercial (ARDEN-BE-008, auditoria)

> Doc de AUDITORIA (sem código). Candidato líder: Anthropic Claude. Os modelIds e limites
> reais NÃO são fixados aqui — mudam com frequência. Ver "REQUER VERIFICAÇÃO EXTERNA".

O provider comercial precisa de uma **allowlist explícita** de modelos (catálogo FECHADO),
mesmo padrão do provider interno (`MODEL_PROVIDER_DEFINITIONS`). O runtime só usa modelIds
listados; qualquer outro → rejeição, nunca fallback.

## PROIBIDO (fonte do modelId)
- `modelId` arbitrário/livre;
- `modelId` vindo do request de execução;
- `modelId` vindo do step;
- `modelId` de outro provider (cross-provider);
- modelo `DEPRECATED` sem aviso; modelo fora da allowlist → `MODEL_PROVIDER_NOT_AVAILABLE`
  (registry) / modelId não catalogado → rejeitado.

O `modelId` é fixado na `ModelConfiguration` (tenant-scoped), validado contra a allowlist
do provider — nunca deriva do input de execução (espelha o padrão do BE-007.1).

## Shape do catálogo (SÓ formato — valores reais requerem verificação)
Espelha `MODEL_PROVIDER_DEFINITIONS`. Cada entrada:

```
{
  modelId:            '<REQUER VERIFICAÇÃO EXTERNA>',   // id canônico do provider
  displayName:        '<REQUER VERIFICAÇÃO EXTERNA>',
  status:             'ACTIVE' | 'DEPRECATED' | 'DISABLED',
  capabilities:       ['STRUCTURED_OUTPUT', 'TOOL_CALLING', ...],
  productionAllowed:  true,                             // provider comercial = produção
  maxInputTokens:     '<REQUER VERIFICAÇÃO EXTERNA>',
  maxOutputTokens:    '<REQUER VERIFICAÇÃO EXTERNA>',   // limite contratual do provider
  rateCardRef:        { providerKey, providerVersion, modelId }, // → model_rate_cards
  deprecation:        null | { since, replacementModelId, notice }, // metadados de deprecação
}
```

O provider em si segue `modelProviderDefinition` (key, name, version, capabilities[],
`status` ACTIVE|DEPRECATED|DISABLED, `productionAllowed=true`, `systemManaged`).

## Relação com rate cards
Cada modelo do catálogo referencia uma entrada `model_rate_cards`
(`AGENT_MODEL_RATE_CARDS.md`). Rate cards comerciais são um catálogo VERSIONADO em código
(padrão `MODEL_RATE_CARDS`, projeção idempotente por `catalog_hash`), com:

- valores em **unidade menor** por milhão de tokens (input/output/cached);
- `source` (origem do preço) e datas efetivas;
- SEM chamada de preço em tempo real;
- preços **verificados antes da implementação** — nunca inventados. Todo valor comercial
  fica marcado "REQUER VERIFICAÇÃO EXTERNA" até confirmação na tabela oficial do provider.

`ModelRateCardsRepository.findActive` sem card → custo `null` + `COST_RATE_CARD_NOT_AVAILABLE`
(não bloqueia execução, mas sinaliza catálogo incompleto).

## REQUER VERIFICAÇÃO EXTERNA (na implementação)
- ids canônicos e displayNames dos modelos vigentes;
- janelas de contexto / max output tokens por modelo;
- preços (input/output/cached) e moeda por milhão de tokens;
- capacidades reais (structured output, tool calling) e status de deprecação;
- nome do pacote/SDK e endpoints do provider.
