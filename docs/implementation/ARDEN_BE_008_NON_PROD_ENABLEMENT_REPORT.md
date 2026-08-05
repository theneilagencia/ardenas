# ARDEN-BE-008.4 — relatório: smoke test real + habilitação restrita não produtiva

Entrega a **infraestrutura** de smoke test real controlado (008.4B) e a **habilitação restrita
não produtiva** (008.4D), **sem** remover os bloqueios de produção. A **chamada real (008.4C)
NÃO foi executada** — sem credencial oficial de teste, sem documentos oficiais (008.4A =
UNVERIFIED). Provider persistido permanece `DISABLED`; pricing/governança seguem **UNVERIFIED**.

**Estado explícito:**
- Infraestrutura de smoke test: **PRONTA** (provada offline).
- Chamada real ao provider: **NÃO EXECUTADA**.
- Habilitação restrita não produtiva: **implementada** (gate + quotas + breaker + binding).
- Disponibilidade em produção: **NÃO**.
- Verificação de governança/preços: **UNVERIFIED**.

## 1. Arquitetura

```
CLI admin (npm run smoke:anthropic)
  → AnthropicSmokeTestService
  → AnthropicNonProdGate (produção? allowlist? gate externo? breaker? quota?)
  → AnthropicModelProvider (context.smokeTest = true)
  → AnthropicProviderCredentialResolver → SecretVault
  → ANTHROPIC_TRANSPORT (SDK real em dev/staging; fake em test)
  → AnthropicResponseMapper → validação local de JSON Schema
  → AnthropicSmokeTestResult (sanitizado) + audit + marca na versão de credencial
```

O smoke atravessa a arquitetura **normal** do 008.3 (não faz bypass do provider). O único sinal
adicional é `smokeTest=true`.

## 2. Componentes

- **AnthropicNonProdGate (008.4D)** — autoriza chamada real só quando: NÃO produção (lê
  `NODE_ENV` ao vivo), gate de chamadas externas ON, organização em allowlist server-side, circuit
  breaker `CLOSED`, dentro das quotas. Execução normal de agente exige, adicionalmente, versão de
  credencial com smoke `PASSED`.
- **Quotas / denial-of-wallet** — `ANTHROPIC_NON_PROD_MAX_OUTPUT_TOKENS` (256, com clamp de
  `max_tokens` no caminho real), `ANTHROPIC_NON_PROD_DAILY_CALL_CAP` (50/dia/org),
  `ANTHROPIC_NON_PROD_MAX_CONCURRENCY` (1). Nenhum valor monetário estimado exibido.
- **Circuit breaker** — in-memory por processo; `CLOSED/OPEN/HALF_OPEN`; abre após
  `ANTHROPIC_CIRCUIT_BREAKER_THRESHOLD` (5) falhas consecutivas; `HALF_OPEN` após
  `ANTHROPIC_CIRCUIT_BREAKER_COOLDOWN_MS` (60s); sucesso reseta. Sem retry storm.
- **Binding smoke ↔ credencial** — `PASSED` grava `smokeTest={status,credentialVersionId,modelId,at}`
  nos metadados da versão de credencial.
- **Invalidização por rotação** — nova versão de credencial nasce **sem** o metadado → smoke
  invalidado, novo smoke exigido; sem fallback para a versão antiga.

## 3. Reutilizado vs. novo

| Bloco | Path | Estado |
| --- | --- | --- |
| Provider executável (008.3) | `apps/api/src/agents/providers/anthropic/anthropic-model-provider.ts` | reutilizado |
| Resolver de credencial (008.3) | `.../anthropic/anthropic-provider-credential.resolver.ts` | reutilizado |
| Porta/transporte + fake (008.3) | `.../anthropic/anthropic-transport.port.ts` · `.../anthropic-fake-transport.ts` | reutilizado |
| Mappers puros (008.1) | `.../anthropic/anthropic-{request,response,error}-mapper.ts` | reutilizado |
| Cofre de credenciais (BE-006) | `apps/api/src/connectors/credentials/*` | reutilizado |
| Serviço de smoke test | `.../anthropic/AnthropicSmokeTestService` | novo |
| Non-prod gate | `.../anthropic/anthropic-non-prod-gate.ts` | novo |
| CLI admin | `apps/api/src/scripts/anthropic-smoke-test.cli.ts` | novo |
| Result sanitizado | `AnthropicSmokeTestResult` | novo |
| Specs offline | `.../anthropic-non-prod-gate.spec.ts` · `apps/api/test/anthropic-smoke-test.integration.spec.ts` | novo |

**Sem migração** (verificação nos metadados da versão de credencial), **sem endpoint novo de
geração**, **OpenAPI diff-free**. CLI admin-only; **nenhuma mudança funcional de frontend**.

## 4. Invariantes de segurança (VERIFIED)

- **Credencial só do cofre** — `OrganizationConnection → CredentialVersion ativa → SecretVault`;
  nunca de CLI/env/arquivo/fixture; key usada em memória e descartada, nunca impressa/persistida/
  logada.
- **Canário** — a API key real **nunca** é canário; fake registra só o comprimento.
- **Sanitização** — resultado/audit nunca contêm apiKey/prompt/raw request/raw response/headers/
  request ID bruto; só metadados + hashes sha256 (`requestIdHash`/`responseHash`).
- **Custo** — `estimatedCostMinor=null` / `currency=null` mesmo com usage real
  (`COST_RATE_CARD_NOT_AVAILABLE`); nunca zero.
- **Produção bloqueada** — 4 pontos independentes → `MODEL_PROVIDER_DISABLED`; recusa **antes** de
  resolver credencial ou tocar o SDK; `NODE_ENV` lido ao vivo.
- **Separação de política** — non-prod gate só se aplica com gate de chamadas externas ON; o
  caminho offline do 008.3 (gate OFF, fake) fica inalterado.
- **Provider persistido `DISABLED`** — allowlist é override de ambiente, nunca promoção de estado.

## 5. DEFERRED — 008.5

- **tool calling real** da Anthropic (Fatia 2): tradução de definições de tools e `tool_use`;
- integração com **authority-gradient / aprovações / `ExternalToolExecutor`** (BE-004/005/006);
- ainda **bloqueado em produção** — nenhuma execução externa de ferramenta no adapter;
- rate cards comerciais com preço verificado + `productionAllowed=true` (dependem de reabrir o
  gate 008.4A: pricing e governança hoje UNVERIFIED).

## 6. Referências

`ANTHROPIC_LIVE_SMOKE_TEST`, `ANTHROPIC_SMOKE_TEST_SECURITY`, `ANTHROPIC_NON_PROD_ENABLEMENT`,
`ANTHROPIC_NON_PROD_QUOTAS`, `ANTHROPIC_CIRCUIT_BREAKER`, `ANTHROPIC_CREDENTIAL_REVALIDATION`,
`ANTHROPIC_LIVE_TEST_EVIDENCE_MODEL`, `ANTHROPIC_PRODUCTION_BLOCK` (em `docs/backend/`).
Evidência em `ARDEN_BE_008_LIVE_SMOKE_TEST_EVIDENCE.md`; gates em `ARDEN_BE_008_LIVE_SMOKE_REPORT.md`.
