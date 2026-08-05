# Anthropic — bloqueio de produção (ARDEN-BE-008.4)

> Produção continua bloqueada em pontos independentes, agora somados ao gate de chamada real do
> provider. Qualquer um sozinho barra a execução em produção → `MODEL_PROVIDER_DISABLED`. O
> ambiente é lido **ao vivo** (`process.env.NODE_ENV`). Fonte: código do 008.3/008.4D.
> Complementa `ANTHROPIC_RUNTIME_FEATURE_GATES.md`.

## 1. Pontos de recusa (VERIFIED)

Quatro seams independentes; nenhum depende dos outros:

| # | Ponto | Recusa em produção |
| --- | --- | --- |
| 1 | resolver do provider (registro condicional) | factory não registra em `production` |
| 2 | ativação de `ModelConfiguration` | provider `DISABLED` → `MODEL_PROVIDER_DISABLED` |
| 3 | publicação de `AgentVersion` | config de modelo não-ativável não pode ser publicada |
| 4 | gate de chamada real do provider (008.4D) | produção → `MODEL_PROVIDER_DISABLED` antes de resolver credencial/SDK |

Os três primeiros vêm do 008.3; o quarto é o `AnthropicNonProdGate` do 008.4D.

## 2. Gate de chamada real (VERIFIED)

Antes de resolver credencial ou tocar o SDK, o gate exige ambiente **não** produtivo. Em
produção → `MODEL_PROVIDER_DISABLED` **imediatamente** — a credencial não é resolvida e o SDK
não é chamado. Vale para execução normal de agente **e** para o smoke test.

## 3. Leitura viva do ambiente (ARCHITECTURAL_DECISION)

O gate lê `process.env.NODE_ENV` **ao vivo** (defense in depth), não um valor cacheado em
config na inicialização. Assim, mesmo que um flag seja ligado por engano, a checagem de ambiente
reflete o valor corrente no momento da chamada.

## 4. Estado persistido inalterado (VERIFIED)

O provider persistido permanece `DISABLED` / `productionAllowed=false`; o catálogo do 008.2B
**não** é alterado para simular execução. A allowlist não produtiva
(`ANTHROPIC_NON_PROD_ALLOWED_ORGANIZATION_IDS`) é override de ambiente, nunca promoção do estado
persistido — ver `ANTHROPIC_NON_PROD_ENABLEMENT.md`.

## 5. NUNCA

- registrar o provider em `NODE_ENV === 'production'`;
- resolver credencial ou tocar o SDK em produção (recusa **antes** de ambos);
- promover o status persistido do provider/modelos para habilitar produção;
- ler `NODE_ENV` de cache em vez do valor vivo no momento da chamada.
