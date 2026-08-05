# Conector Anthropic — `system.anthropic` (ARDEN-BE-008.2)

> Fase ADMINISTRATIVA, NÃO executável. O conector permite configurar a conexão e
> guardar a credencial; **nenhuma chamada de modelo acontece**. O modelo é executado
> pelo `ModelProvider` em fase futura, não como ferramenta de conector.

## 1. Definição canônica

Conector system-managed projetado a partir do catálogo canônico
(`CONNECTOR_DEFINITIONS` em `src/contracts/connectors/connector-catalog.ts`):

| Campo | Valor |
| --- | --- |
| `key` | `system.anthropic` |
| `version` | `'1'` |
| `category` | `MODEL_PROVIDER` |
| `status` | `ACTIVE` |
| `systemManaged` | `true` |
| `productionAllowed` | `true` |
| `supportedActions` / `capabilityKeys` | `[]` — **sem ferramenta de geração** |

O conector estar `ACTIVE` habilita apenas operações administrativas (conexão +
credencial). Não implica execução de modelo: `capabilityKeys` é vazio de propósito.

## 2. Schemas

**`credentialSchema`** — write-only:

```
{ apiKey: string (writeOnly, minLength 1, maxLength 512) }
```

**`configurationSchema`** — não sensível:

```
{
  baseUrlMode: 'OFFICIAL',   // enum literal de valor único — sem override
  timeoutMs: integer,         // 1000..120000
  maximumRetries: integer     // 0..5
}
```

A base URL é travada em `OFFICIAL`; não há `baseUrl`/proxy/host arbitrário.

## 3. Projeção idempotente

O conector é materializado no banco pela `runCatalogProjection` já existente (BE-006),
idempotente (upsert por chave/versão). Nenhuma projeção nova foi criada para o Anthropic;
ele apenas entra como mais uma entrada do catálogo canônico.

## 4. Três identidades distintas — não confundir

- **connector key** `system.anthropic` — a definição de conector (guarda credencial/config);
- **provider key** `anthropic.direct` — o `ModelProviderDefinition` que executará o modelo
  em fase futura (ver `ANTHROPIC_PROVIDER_CATALOG_PERSISTENCE.md`);
- **credential type** `ANTHROPIC_API_KEY` (conceitual) — a natureza da credencial guardada.

Conector ≠ provider ≠ tipo de credencial. O conector é a superfície administrativa; o
provider é a superfície de execução (ainda `DISABLED`).

## 5. NUNCA

- expor uma ferramenta/ação de geração no conector (`supportedActions` é `[]`);
- tratar o conector `ACTIVE` como "provider executável";
- permitir base URL fora de `OFFICIAL` via configuração.
