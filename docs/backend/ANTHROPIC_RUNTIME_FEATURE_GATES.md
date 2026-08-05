# Anthropic — feature gates de runtime (ARDEN-BE-008.3)

> Dois flags, **default `false`**, separam "registrar o provider" de "autorizar a rede".
> Registro condicional por composição. Em produção nesta fase o provider **não** é registrado
> e a execução permanece bloqueada em três pontos independentes. Fonte: `env.schema.ts`.

## 1. Os dois flags (VERIFIED)

Ambos booleanish, default `false` (`env.schema.ts`):

| Flag | Efeito | Default | Produção (esta fase) |
| --- | --- | --- | --- |
| `ANTHROPIC_PROVIDER_RUNTIME_ENABLED` | registra o provider no registry | `false` | `false` |
| `ANTHROPIC_PROVIDER_EXTERNAL_CALLS_ENABLED` | autoriza o transporte real a tocar a rede | `false` | `false` |

Separação intencional: registrar o provider (para exercitar o fluxo com o transporte fake)
**não** implica permissão para chamar a rede. O transporte real só sai para a rede com o
segundo flag ligado; o transporte de teste é sempre o fake, por composição (`NODE_ENV`).

## 2. Registro condicional (ARCHITECTURAL_DECISION)

`InMemoryModelProviderRegistry` é construído por um **factory**. O provider Anthropic só é
registrado quando:

```
ANTHROPIC_PROVIDER_RUNTIME_ENABLED === true  &&  NODE_ENV !== 'production'
```

Em produção nesta fase: **NÃO registrado**. Requisição de execução para `anthropic.direct`
não encontra provider → falha canônica, sem tocar rede.

## 3. Produção continua bloqueada — 3 pontos de recusa

Mesmo que um flag fosse ligado por engano, a execução em produção é recusada em três seams
independentes:

1. **resolver do provider** (registro condicional): factory não registra em `production`;
2. **ativação de `ModelConfiguration`**: provider `DISABLED` → `MODEL_PROVIDER_DISABLED`;
3. **publicação de `AgentVersion`**: config de modelo não-ativável não pode ser publicada.

Nenhum dos três depende dos outros; qualquer um sozinho barra a execução em produção.

## 4. `MODEL_PROVIDER_DISABLED`

O provider persistido permanece `DISABLED` / `productionAllowed=false` (catálogo do 008.2B
inalterado). A ativação de configuração retorna o código canônico já existente
`MODEL_PROVIDER_DISABLED` — nenhum código novo. O catálogo persistido **não** é alterado para
simular execução; o E2E offline usa um override **test-only** da linha do provider no DB.

## 5. NUNCA

- ligar `ANTHROPIC_PROVIDER_EXTERNAL_CALLS_ENABLED` em produção nesta fase;
- registrar o provider em `NODE_ENV === 'production'`;
- alterar o status persistido do provider/modelos para habilitar execução;
- tratar "registrado" como "autorizado a chamar a rede" (são flags distintos).

## 6. Estado

Execução em produção: **NÃO** (3 recusas). Rede: **NÃO** (default `false`). Provider
persistido: **DISABLED**. Governança: **UNVERIFIED**.
