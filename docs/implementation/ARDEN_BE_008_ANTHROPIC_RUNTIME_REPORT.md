# ARDEN-BE-008.3 — relatório: provider Anthropic executável (atrás de gate)

Converte a infraestrutura administrativa do 008.2B em um provider **executável em runtime** —
mas **apenas atrás de feature gate de teste/desenvolvimento** e **sem nenhuma chamada externa
real** nesta fase. Instala o SDK oficial (pinado), isola-o atrás de uma porta de transporte,
implementa o `AnthropicModelProvider` (structured output, Fatia 1) e um transporte fake
offline, com registro condicional e produção bloqueada. Preços e governança de dados
permanecem **UNVERIFIED**; provider persistido permanece **DISABLED**.

## 1. Objetivo

Tornar o provider `anthropic.direct@1` executável pelo runtime já existente, reusando runtime,
vault, mappers e observabilidade, com a menor superfície nova possível — **sem** chamada
externa nesta fase (execução atrás de gate, transporte real gated na rede, testes offline).

**Estado explícito:**
- Código do provider executável: **SIM**, atrás de feature gate de teste/desenvolvimento.
- Chamada externa ao provider: **NÃO**.
- Disponibilidade em produção: **NÃO**.
- Verificação de governança: **UNVERIFIED**.

## 2. Arquitetura

```
AgentRuntime
  → InMemoryModelProviderRegistry (factory, registro condicional)
  → AnthropicModelProvider (anthropic.direct@1)
  → mappers puros (request / response / usage / erro — 008.1)
  → AnthropicTransport (porta, token ANTHROPIC_TRANSPORT)
      → AnthropicSdkTransport (real, gated na rede)  |  FakeAnthropicTransport (offline)
```

Integração **provider-neutra**: o runtime chama `generate(request, context)` com um
`ModelGenerationContext` não-secreto (`organizationId`, `modelConfigurationId`,
`credentialConnectionId`, `correlationId`, `deadlineMs`) — nenhum `if provider === 'anthropic'`
no runtime; a resolução de credencial é seam interno do provider.

## 3. Reutilizado sem alteração (VERIFIED)

| Bloco reutilizado | Artefato |
| --- | --- |
| Mappers puros (request/response/usage/erro) | `apps/api/src/agents/providers/anthropic/anthropic-{request,response,error}-mapper.ts` (008.1) |
| Cofre de credenciais (AES-256-GCM) | `apps/api/src/connectors/credentials/*` (BE-006.4) |
| Recorder de evidência de model-call | pipeline BE-007.6 |
| Validador de output determinístico | `AgentOutputValidatorV1` (BE-006.6/007.3) + `AGENT_OUTPUT_REPAIR` |
| Retry/UNKNOWN (política) | `ANTHROPIC_RETRY_AND_UNKNOWN.md` (008.1) |
| Catálogo/provider persistido `DISABLED` | `model_catalog_entries` (008.2B, inalterado) |
| Tenant scoping | `organizationId` da `ExecutionRun`; cross-tenant → not found |

## 4. Adicionado (ARCHITECTURAL_DECISION)

| Novo artefato | Path | Estado |
| --- | --- | --- |
| SDK oficial pinado | `apps/api/package.json` — `@anthropic-ai/sdk@0.115.0` exato | só em `@arden/api` |
| Porta de transporte | `.../anthropic/anthropic-transport.port.ts` + `anthropic-transport.types.ts` | tipos internos |
| Transporte real (SDK) | `.../anthropic/sdk/anthropic-sdk-transport.ts` | gated na rede |
| Transporte fake offline | `.../anthropic/anthropic-fake-transport.ts` | 16 cenários |
| Provider executável | `.../anthropic/anthropic-model-provider.ts` | `anthropic.direct@1` |
| Resolver de credencial | `.../anthropic/anthropic-provider-credential.resolver.ts` | tenant-scoped |
| Compatibilidade de schema | `.../anthropic/anthropic-schema-compatibility.ts` | rejeita `$ref`/depth/props/size |
| Política de retry do adapter | `.../anthropic/anthropic-retry-policy.ts` | backoff+jitter+Retry-After+deadline |
| Métricas de provider | `.../agents/.../agent-metrics.ts` | label `retryable` adicionado |
| Registro condicional | factory do `InMemoryModelProviderRegistry` | `RUNTIME_ENABLED && !production` |

## 5. Feature gates

Dois flags (`env.schema.ts`, booleanish, default `false`), detalhe em
`ANTHROPIC_RUNTIME_FEATURE_GATES.md`:

- `ANTHROPIC_PROVIDER_RUNTIME_ENABLED` — registra o provider no registry;
- `ANTHROPIC_PROVIDER_EXTERNAL_CALLS_ENABLED` — autoriza o transporte real a tocar a rede.

Em produção nesta fase ambos `false`. Registro condicional: só quando
`RUNTIME_ENABLED && NODE_ENV !== 'production'`. Produção bloqueada em **3 pontos**: resolver do
provider, ativação de `ModelConfiguration` (`MODEL_PROVIDER_DISABLED`) e publicação de
`AgentVersion`. Transporte de teste é o fake, por composição (`NODE_ENV==='test'`).

## 6. Invariantes de segurança (VERIFIED)

- **SDK isolado**: importado só em `sdk/anthropic-sdk-transport.ts`; nenhum tipo do SDK escapa
  da porta (teste de arquitetura `anthropic-sdk-boundary.spec.ts`).
- **Sem chamada real**: transporte real gated (`EXTERNAL_CALLS_ENABLED=false` lança sem tocar a
  rede); testes 100% offline (fake + guarda de rede).
- **Segredo em memória**: apiKey resolvida no cofre, usada em memória, descartada; nunca em
  log/audit/evidência/métrica/usage/job/checkpoint; fake registra só o comprimento.
- **Provider-neutro**: sem ramificação por provider no runtime; contexto não-secreto.
- **Structured output**: backend autoritativo; validação local determinística; tool sintética
  forçada; `tools` reais `= []`; `tool_use` sintético normalizado para `finishReason=STOP`.
- **Sem tool calling real**; sem execução no adapter.
- **UNKNOWN**: nunca sucesso, nunca retry cego (`MODEL_RESULT_UNKNOWN`).
- **Custo**: sem rate card → `null` + `COST_RATE_CARD_NOT_AVAILABLE`, nunca zero.
- **Persistência**: provider `DISABLED`/`productionAllowed=false`; catálogo persistido
  **não** alterado (E2E usa override test-only); **sem migração**, sem endpoint novo, OpenAPI
  diff-free; frontend não alterado.

## 7. DEFERRED — 008.4

- verificação oficial **manual** de pricing e governança de dados (páginas hoje sob 403);
- **smoke test real controlado** (credencial real, custo controlado, fora do PR público, sem
  dados reais de cliente);
- habilitação **restrita** do provider (registro/rede) só após reabertura do gate;
- tool calling normalizado (Fatia 2);
- rate cards comerciais com preço verificado; ativação de `ModelConfiguration`
  (`productionAllowed=true`).

## 8. Referências

`ANTHROPIC_SDK_INTEGRATION`, `ANTHROPIC_TRANSPORT_ARCHITECTURE`, `ANTHROPIC_MODEL_PROVIDER`,
`ANTHROPIC_RUNTIME_FEATURE_GATES`, `ANTHROPIC_REQUEST_SECURITY`, `ANTHROPIC_RESPONSE_SECURITY`,
`ANTHROPIC_STRUCTURED_OUTPUT_RUNTIME`, `ANTHROPIC_RUNTIME_ERRORS`, `ANTHROPIC_RUNTIME_RETRY`,
`ANTHROPIC_RUNTIME_OBSERVABILITY`, `ANTHROPIC_OFFLINE_TEST_TRANSPORT` (em `docs/backend/`).
Evidência em `ARDEN_BE_008_ANTHROPIC_RUNTIME_TEST_EVIDENCE.md`.
