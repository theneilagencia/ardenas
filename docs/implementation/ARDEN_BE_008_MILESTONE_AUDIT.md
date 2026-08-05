<!-- Milestone: ARDEN-BE-008.7 -->
# ARDEN-BE-008 — Auditoria independente do milestone

> Revisão nova (não consolidação de relatórios). Cada CHECK traz STATUS + EVIDENCE +
> TEST + RISK. Estado imutável do milestone: provider **DISABLED**,
> `productionAllowed=false`, pricing/governança **UNVERIFIED**, live smoke e live tool
> calling **NOT EXECUTED**, produção **BLOQUEADA**.

## Preflight
- Branch `claude/arden-be-008-commercial-model-provider-audit`; base do milestone
  `3a2ae746a1e1c0af34b28ff5fbf1ba1485d52a25`; working tree limpo no início.
- Linhagem 008.1–008.6 presente (`git log`). Uma única migration aditiva desde a base
  (`apps/api/prisma/migrations/20260803140219_anthropic_connection_catalog`). Nenhuma
  migration anterior editada; nenhum force-push; nenhuma reescrita de branch.

## Escopo positivo (amostra auditada)

| CHECK | STATUS | EVIDENCE |
| --- | --- | --- |
| Contratos Anthropic (keys, catálogo, credential, connection, model-config) | PASS | `src/contracts/model-providers/anthropic/*` |
| Catálogo allowlisted (3 snapshots, IDs exatos, todos DISABLED, sem preço) | PASS | `anthropic-model-catalog.schema.ts:50` |
| Connector `system.anthropic` + provider `anthropic.direct@1` DISABLED | PASS | `anthropic-provider-keys.ts`, seed projeta DISABLED |
| Credential write-only + SecretVault (AES-256-GCM) + rotation + revocation | PASS | `credential-versions.service.ts`, BE-006.4 |
| Validação local `NOT_VERIFIED_WITH_PROVIDER` (sem segredo) | PASS | `connection.schema.ts:122`; integ. §17 |
| ModelConfiguration DRAFT + activation block (`MODEL_PROVIDER_DISABLED`) | PASS | integ. §45 |
| SDK pinado + transport boundary + fake/SDK transport + provider | PASS | `sdk/anthropic-sdk-transport.ts` (único import) |
| Structured output + request/response/usage mapping + retry/timeout/UNKNOWN | PASS | `anthropic-mappers.spec.ts`, runtime integ. |
| Tool calling (definition mapping, `tool_use`, authority, approvals, executor, continuation) | PASS | `anthropic-tool-calling.integration.spec.ts` |
| Frontend administrativo (catálogo, connection, rotação, model-config, AgentVersion, execução) | PASS | `src/features/anthropic/*`, `AgentVersionEditorPage.tsx`, `ExecutionAgentUsagePanel.tsx` |
| known-zero vs unknown cost | PASS | `agent-format.ts:20`, `ExecutionAgentUsagePanel.test.tsx` |
| Offline E2E + production block | PASS | `e2e/api/anthropic-admin-api.spec.ts`, integ. suites |

## Escopo negativo (ausências comprovadas)

| CHECK | STATUS | EVIDENCE |
| --- | --- | --- |
| Provider ativo em produção / `productionAllowed=true` / persisted ACTIVE | AUSENTE | seed projeta DISABLED; env-gate recusa runtime |
| Chamada real automática / smoke real / tool ao vivo declarados | AUSENTE | live = NOT EXECUTED em todos os relatórios |
| Preço/rate card Anthropic inventado; governança "verificada" | AUSENTE | `runRateCardProjection` não projeta Anthropic; docs = UNVERIFIED |
| API key no frontend / env var como credencial tenant / base URL / headers / modelId livres | AUSENTE | connection fixa OFICIAL; key write-only; catálogo allowlist |
| Endpoint de geração/chat/prompt/playground | AUSENTE | grep §20 vazio |
| SDK Anthropic no frontend; 2º SDK comercial (OpenAI/Bedrock/Vertex/LangChain/LlamaIndex) | AUSENTE | grep §7 vazio; SDK só em `apps/api/.../sdk/` |
| Raw request/response/prompt/contexto persistidos; segredo em log/audit/evidence | AUSENTE | grep §20 vazio; sanitização testada |
| Billing/RAG/embeddings/streaming/vision/computer-use | AUSENTE | não implementados (fora de escopo) |

## Fixture `CONNECTOR_MASTER_KEY` (§6)
- Valor: `Buffer.alloc(32,7)` Base64 — **público, não-secreto**, só em `test/setup-env.ts`
  e `playwright.api.config.ts`. Ausente do frontend, do runtime normal e de qualquer
  config de produção.
- Guard: `env.schema.ts` (`WELL_KNOWN_TEST_MASTER_KEYS`) faz `loadConfig` **recusar**
  iniciar em `production` com qualquer fixture conhecida. Coberto por
  `env.schema.spec.ts` (production rejeita; test aceita; chave real de 32 bytes aceita).

## Conclusão
Auditoria independente: **PASS** — sem itens essenciais deferidos dentro do escopo
aprovado; produção permanece bloqueada; verificações live permanecem NOT EXECUTED.
