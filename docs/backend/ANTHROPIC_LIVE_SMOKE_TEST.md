# Anthropic — smoke test real controlado (ARDEN-BE-008.4)

> Comando administrativo dedicado que exerce **uma** chamada real mínima ao provider em
> ambiente NÃO produtivo, atravessando a arquitetura normal (sem bypass). A infraestrutura
> está pronta e provada **offline**; a chamada real **NÃO foi executada** (sem credencial
> oficial/documentos). Provider persistido segue `DISABLED`. Fonte: código do 008.4B/C.

## 1. Comando (VERIFIED)

```
npm run smoke:anthropic   →   apps/api/src/scripts/anthropic-smoke-test.cli.ts
```

CLI interna, guardada por `ARDEN_CLI=anthropic-smoke`. **Fora** de `test`/`test:api`/
`test:api:integration`/CI/seed/startup/worker — nenhuma suíte normal a invoca, nenhuma rede
na suíte normal. É admin-only; **nenhuma mudança funcional de frontend**.

## 2. Gates de disparo (VERIFIED)

A chamada real só ocorre com **TODAS** as condições satisfeitas:

| Condição | Origem |
| --- | --- |
| `NODE_ENV != production` | ambiente (leitura viva) |
| `ANTHROPIC_PROVIDER_RUNTIME_ENABLED` | flag |
| `ANTHROPIC_PROVIDER_EXTERNAL_CALLS_ENABLED` | flag |
| `ANTHROPIC_SMOKE_TEST_ENABLED` | flag |
| `ANTHROPIC_SMOKE_TEST_ACKNOWLEDGED` | flag (acknowledgment) |
| `--confirm-live-anthropic-call` | argumento explícito da CLI |
| `--organizationId` / `--connectionId` / `--modelConfigurationId` | argumentos explícitos |

Sem a confirmação explícita → `SMOKE_TEST_CONFIRMATION_REQUIRED`. Organização fora do
allowlist server-side ou ambiente de produção → `MODEL_PROVIDER_DISABLED` (antes de resolver
credencial ou tocar o SDK).

## 3. Caminho REAL (não faz bypass) (ARCHITECTURAL_DECISION)

O smoke passa pela **mesma** arquitetura do runtime — não há atalho para o SDK:

```
AnthropicSmokeTestService
  → AnthropicModelProvider (context.smokeTest = true)
  → AnthropicProviderCredentialResolver → SecretVault
  → ANTHROPIC_TRANSPORT (SDK real em dev/staging; fake em test)
  → AnthropicResponseMapper
  → validação local de JSON Schema
```

Reusa provider, resolver, mappers e validação do 008.3. `smokeTest=true` é o único sinal
adicional; o provider **não** é contornado.

## 4. Payload sintético fixo (VERIFIED)

Determinístico, sem dado de cliente:

- system: task `"Return a structured health check response"`;
- **uma** mensagem de usuário: `{"request_id":"smoke-test"}`;
- output schema: `{ status: enum["ok"], provider: string }`, `additionalProperties:false`,
  ambos `required`;
- `tools = []`; `maxOutputTokens` baixo (`ANTHROPIC_NON_PROD_MAX_OUTPUT_TOKENS`, default 256);
- timeout 20s; **1** chamada de modelo.

## 5. Resultado e custo (VERIFIED)

Retorna `AnthropicSmokeTestResult` sanitizado (ver `ANTHROPIC_LIVE_TEST_EVIDENCE_MODEL.md`):
`status ∈ {PASSED, FAILED, UNKNOWN}`, ids, `authenticationValidated`,
`structuredOutputValidated`, tokens reportados pelo provider, hashes. **Custo**:
`estimatedCostMinor=null`, `currency=null` mesmo com usage real — sem rate card verificado →
warning `COST_RATE_CARD_NOT_AVAILABLE`. Em `PASSED`, a verificação é gravada nos metadados da
**versão de credencial** (ver `ANTHROPIC_CREDENTIAL_REVALIDATION.md`).

## 6. Estado — NOT_EXECUTED

A chamada real **não foi executada** (008.4C): sem credencial oficial de teste, sem documentos
oficiais (008.4A = UNVERIFIED), sem confirmação de operador. O caminho está implementado e
provado **offline** pelo fake transport. **Não** afirmar qualquer verificação ao vivo.

## 7. PROIBIDO

- rodar o smoke sem confirmação explícita **e** credencial legítima do cofre;
- ler a API key de CLI/env/arquivo/fixture (§credencial vem só do cofre);
- executar em produção; alterar `productionAllowed` para habilitar; gravar custo/rate card;
- tratar a prova offline como verificação ao vivo.
