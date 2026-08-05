# Persistência do catálogo de provider Anthropic (ARDEN-BE-008.2)

> `ModelProviderDefinition` `anthropic.direct` é projetado no banco com status
> `DISABLED`. Persistir o catálogo **não** o torna executável.

## 1. Definição persistida

Tabela `model_provider_definitions`:

| Campo | Valor |
| --- | --- |
| `key` | `anthropic.direct` |
| `version` | `'1'` |
| `status` | `DISABLED` |
| `productionAllowed` | `false` |
| `capabilities` | `['STRUCTURED_OUTPUT']` |
| `systemManaged` | `true` |

## 2. Projeção que honra o status canônico

Projetado por `runModelProviderCatalogProjection` — idempotente, upsert por
`catalogHash`. A mudança de 008.2: a projeção agora **honra o `status` canônico** da
definição (antes era hardcoded `ACTIVE`). Assim, providers comerciais como o Anthropic
persistem corretamente como `DISABLED`, em vez de nascerem `ACTIVE` por engano.

## 3. Não executável em runtime

O provider **não** é registrado no `InMemoryModelProviderRegistry`. Não há
implementação de execução acessível: nenhum `messages.create`, nenhum fetch a
`api.anthropic.com`, nenhuma dependência de SDK.

## 4. `implementationStatus` é DERIVADO

`implementationStatus = CONTRACT_ONLY` é **derivado**, não uma coluna nova no banco:

```
CONTRACT_ONLY  ⇐  status = DISABLED
              ∧  productionAllowed = false
              ∧  sem registro em runtime (não registrado no registry)
```

Nenhuma coluna `implementationStatus` foi adicionada — deriva-se do estado persistido.

## 5. Endpoints de leitura

```
GET /model-providers            # lista definições persistidas
GET /model-providers/{key}      # detalha (ex.: anthropic.direct)
```

## 6. NUNCA

- registrar `anthropic.direct` no registry de runtime nesta fase;
- projetar o provider como `ACTIVE`/`productionAllowed=true`;
- adicionar coluna de `implementationStatus` (é derivado do status).
