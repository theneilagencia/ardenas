# Persistência do catálogo de modelos Anthropic (ARDEN-BE-008.2)

> Nova tabela aditiva `model_catalog_entries` persiste **apenas snapshots datados
> VERIFICADOS**. Todos `DISABLED`. Limites de token são `null` (UNVERIFIED — docs 403).

## 1. Tabela e migração

Tabela aditiva `model_catalog_entries`, criada na migração
`20260803140219_anthropic_connection_catalog`. Aditiva: não altera tabelas existentes.

## 2. Snapshots persistidos (VERIFIED)

Os 3 snapshots datados da união `Model` do SDK oficial `@anthropic-ai/sdk@0.115.0`:

| `modelId` | Status | `productionAllowed` |
| --- | --- | --- |
| `claude-opus-4-5-20251101` | `DISABLED` | `false` |
| `claude-sonnet-4-5-20250929` | `DISABLED` | `false` |
| `claude-haiku-4-5-20251001` | `DISABLED` | `false` |

Campos por entrada:

- `maximumInputTokens` / `maximumOutputTokens` = **`null`** (UNVERIFIED — a doc oficial
  retornou 403; `null` não é 0 nem "ilimitado");
- `rateCardKey` = `null` (preço UNVERIFIED — ver `ANTHROPIC_RATE_CARD_PERSISTENCE.md`);
- `sourceReferences` citando o SDK `@anthropic-ai/sdk@0.115.0` (união `Model`).

## 3. Projeção

`runModelCatalogProjection` — idempotente, upsert por `catalogHash`. Entradas
**removidas** do catálogo canônico passam a `DEPRECATED` (não são apagadas).

## 4. Endpoint de leitura

```
GET /model-providers/{key}/versions/{version}/models   # permissão model_provider.view
```

## 5. Regras

- **snapshots datados apenas** — nenhum alias mutável como identidade operacional
  (reprodutibilidade de execução/avaliação);
- **nenhum modelo novo** sem fonte oficial: adicionar modelo exige leitura direta;
- não afirmar limites de token nem preços não verificados — ficam `null`.
