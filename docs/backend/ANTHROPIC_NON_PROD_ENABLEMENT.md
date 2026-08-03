# Anthropic — habilitação restrita não produtiva (ARDEN-BE-008.4D)

> `AnthropicNonProdGate`: autoriza chamadas reais **apenas** em ambiente não produtivo, para
> organizações explicitamente na allowlist server-side, sem alterar o status persistido do
> provider (segue `DISABLED`). Produção sempre bloqueada. Fonte: código do 008.4D.

## 1. Condições para chamada real (VERIFIED)

A chamada externa real (com o gate de chamadas externas **ON**) só ocorre quando **todas**:

| Condição | Detalhe |
| --- | --- |
| NÃO produção | lê `process.env.NODE_ENV` **ao vivo** (defense in depth) |
| gate de chamadas externas ligado | `ANTHROPIC_PROVIDER_EXTERNAL_CALLS_ENABLED` |
| organização na allowlist server-side | `ANTHROPIC_NON_PROD_ALLOWED_ORGANIZATION_IDS` (CSV) |
| circuit breaker `CLOSED` | ver `ANTHROPIC_CIRCUIT_BREAKER.md` |
| dentro das quotas | ver `ANTHROPIC_NON_PROD_QUOTAS.md` |

Para execução **normal** de agente (não-smoke), a versão de credencial deve **adicionalmente**
ter smoke `PASSED` (ver §3).

## 2. Estratégia de allowlist por ambiente (ARCHITECTURAL_DECISION)

A habilitação é um **override server-side de ambiente**, não uma promoção de estado persistido:

- allowlist de organizações em `ANTHROPIC_NON_PROD_ALLOWED_ORGANIZATION_IDS` (CSV), lida
  **server-side** — **nunca** vem do request; **sem wildcard** (organização não listada = negada);
- o status persistido do provider **permanece** `DISABLED` / `productionAllowed=false` — o
  catálogo do 008.2B não é alterado para simular execução;
- o override vale só enquanto o ambiente é não produtivo **e** o gate de chamadas externas está
  ligado — não altera a decisão comercial (`CONDITIONALLY_CONFIRMED`).

Separação de política: o non-prod gate aplica-se **apenas** quando o gate de chamadas externas
está ON; a demonstração offline do 008.3 (gate externo OFF, fake transport) fica inalterada.

## 3. Binding smoke ↔ versão de credencial (VERIFIED)

A verificação smoke `PASSED` vive nos **metadados da versão de credencial**
(`smokeTest={status:PASSED, credentialVersionId, modelId, at}`). Para execução normal de agente
a versão de credencial ativa precisa dessa marca. Rotação cria uma nova versão **sem** o
metadado → a verificação é invalidada e um novo smoke é exigido (ver
`ANTHROPIC_CREDENTIAL_REVALIDATION.md`).

## 4. Bloqueio de produção (VERIFIED)

Produção **sempre** → `MODEL_PROVIDER_DISABLED`, avaliado **antes** de resolver credencial ou
tocar o SDK. O provider persistido nunca muda para habilitar produção. Detalhe dos pontos de
recusa em `ANTHROPIC_PRODUCTION_BLOCK.md`.

## 5. NUNCA

- aceitar allowlist de organização vinda do request; usar wildcard;
- ler `NODE_ENV` de cache/config em vez do valor vivo;
- promover o provider persistido para `ENABLED`/`productionAllowed=true`;
- permitir execução normal de agente com versão de credencial **sem** smoke `PASSED`;
- rodar o non-prod gate quando o gate de chamadas externas está OFF (isso é o caminho offline).
