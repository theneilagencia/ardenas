<!-- Milestone: ARDEN-BE-008.7 -->
# ARDEN-BE-008 — Auditoria de segurança

## 1. Boundary do provider
```
AgentRuntime → ModelProvider → AnthropicModelProvider → AnthropicTransport → SDK
```
Nenhum caminho `AgentRuntime → SDK`, `controller → SDK` ou `frontend → SDK`. O SDK
`@anthropic-ai/sdk@0.115.0` (pin exato, sem range) é importado em **um único arquivo**:
`apps/api/src/agents/providers/anthropic/sdk/anthropic-sdk-transport.ts`. Reforçado por
`anthropic-sdk-boundary.spec.ts` e `anthropic-safety.spec.ts`. Frontend: zero import do
SDK (ocorrências são apenas literais de comentário/`sourceReferences`).

## 2. Produção bloqueada
Mesmo com `ANTHROPIC_PROVIDER_RUNTIME_ENABLED`/`EXTERNAL_CALLS`/`TOOL_CALLING`/`SMOKE`
todos `true` em `NODE_ENV=production`: provider não registra/recusa
(`MODEL_PROVIDER_DISABLED`), SDK transport não é chamado, credencial não é
descriptografada, tool mapper e `ExternalToolExecutor` não executam, ModelConfiguration
não ativa, AgentVersion não publica, execução não inicia, custo real = zero por ausência
de chamada, audit sanitizado. Coberto pelas suites `anthropic-runtime` /
`anthropic-tool-calling` (integração) e pelo circuit-breaker em memória.

## 3. Credenciais e cofre
- Tenant-managed; API key **write-only**; versão de credencial com **única ativa**;
  rotation supersede+ativa; revoke com crypto-shredding; revision + idempotency.
- Cofre AES-256-GCM com AAD, nonce/IV único, autenticação; **sem fallback**, **sem global
  API key**, **sem endpoint de leitura de segredo**, **sem plaintext em resposta**.
- Rotation invalida o smoke; cross-tenant bloqueado (404).
- **Limitação documentada:** JavaScript não garante zeroização de memória — o segredo em
  memória é best-effort e de vida curta; não afirmamos apagamento determinístico.

## 4. Canário de segredo (frontend + backend)
- Frontend unit (`AnthropicConnections.test.tsx`) e E2E real
  (`anthropic-admin-api.spec.ts`) provam que a API key **não** aparece no DOM,
  `localStorage`, `sessionStorage` após envio (create e rotate).
- Backend (`anthropic-connection.integration.spec.ts` §43) prova que o segredo é cifrado,
  ausente da resposta e do plaintext no banco. Único lugar com o material: ciphertext
  autenticado no cofre.

## 5. Fixture `CONNECTOR_MASTER_KEY`
Valor público de teste (`Buffer.alloc(32,7)`), classificado explicitamente como
**não-secreto**. `loadConfig` recusa iniciar em production com qualquer fixture conhecida
(`WELL_KNOWN_TEST_MASTER_KEYS`, `env.schema.spec.ts`). Ausente do bundle frontend, do
runtime normal e de config de produção; presente só em `test/setup-env.ts` e
`playwright.api.config.ts`.

## 6. Multitenancy
Alpha↔Beta: acesso cruzado a connection/credential/validation/ModelConfiguration/
execução/result/usage/audit retorna **404 seguro** sem revelar existência nem metadata.
Coberto por `anthropic-connection.integration.spec.ts` §46 e pelas suites multitenancy do
milestone.

## 7. Estática
`grep` §20: sem endpoints de geração/chat/prompt/playground, sem uso direto de
`api.anthropic.com` fora do boundary, sem `rawRequest/rawResponse/fullPrompt/fullContext`
persistidos, sem `console.log` em código de produção.
