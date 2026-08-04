<!-- Milestone: ARDEN-BE-008.5 — Anthropic tool calling (validado OFFLINE apenas) -->
# ARDEN-BE-008.5 — relatório: tool calling Anthropic (Fatia 2, OFFLINE)

> Torna o provider Anthropic capaz de **traduzir** definições de tools e `tool_use`,
> reutilizando integralmente o runtime provider-neutro (007.5) para validação, binding,
> autoridade, aprovação, autorização, execução, isolamento, idempotência e usage. Validado
> **exclusivamente** com `FakeAnthropicTransport`. Provider persistido segue `DISABLED`; produção
> bloqueada; pricing/governança `UNVERIFIED`.

Status desta fatia:
- Tool calling implementation: **OFFLINE VERIFIED**
- Live Anthropic tool calling: **NOT EXECUTED**
- Production: **BLOCKED**

## 1. Objetivo

Ligar tool calling real da Anthropic ao runtime existente com a **menor superfície nova**: só
mappers puros na borda + threading de um codec por request no provider. O runtime não muda e não
conhece "anthropic". O modelo **propõe**; o servidor **decide e executa**.

## 2. Arquitetura

```
AgentRuntimeService (007.5, provider-neutro)
  → AnthropicModelProvider.generate(request, context)   [!prod && ANTHROPIC_TOOL_CALLING_ENABLED]
      → anthropic-tool-definition-mapper (só name/description/input_schema)
      → anthropic-request-mapper (tools[] + tool_choice + structured output)
      → AnthropicTransport → FakeAnthropicTransport (offline)
      → anthropic-response-mapper (reverse-alias via codec → ModelToolCall / TOOL_CALL)
  ← ModelToolCall
  → validator → binding → authority → ActionAuthorization → [approval] → ExternalToolExecutor
  → sanitizer/injection-guard → anthropic-tool-result-mapper → continuação → ... → structured output
```

Detalhe do fluxo em `ANTHROPIC_TOOL_CALLING_RUNTIME.md`.

## 3. Artefatos — reusado vs novo

### 3.1 Novos (borda Anthropic, puros)

| Artefato | Caminho | Papel |
| --- | --- | --- |
| `AnthropicToolNameCodec` | `apps/api/src/agents/providers/anthropic/anthropic-tool-name-codec.ts` | alias↔nome de provider determinístico/reversível por request |
| description guard | `apps/api/src/agents/providers/anthropic/anthropic-tool-description-guard.ts` | isolamento/rejeição de descrição |
| definition mapper | `apps/api/src/agents/providers/anthropic/anthropic-tool-definition-mapper.ts` | `ModelToolDefinition[]` → `{name,description,input_schema}` |
| result mapper | `apps/api/src/agents/providers/anthropic/anthropic-tool-result-mapper.ts` | `AgentToolCallResult` → `tool_result` |
| request mapper (estendido) | `apps/api/src/agents/providers/anthropic/anthropic-request-mapper.ts` | tools[]/tool_choice/continuação/structured output |
| response mapper (estendido) | `apps/api/src/agents/providers/anthropic/anthropic-response-mapper.ts` | reverse-alias, `stop_reason` → `TOOL_CALL` |
| provider (estendido) | `apps/api/src/agents/providers/anthropic/anthropic-model-provider.ts` | gate, threading do codec, custo null |
| transport types (estendido) | `apps/api/src/agents/providers/anthropic/anthropic-transport.types.ts` | blocos text/tool_use/tool_result |
| cenários fake (offline) | `apps/api/src/agents/providers/anthropic/anthropic-fake-transport.ts` | tool_use_then_output, tool_invalid_alias, tool_invalid_input, tool_multiple_calls, tool_repeat_forever, model_unknown_after_tool |

### 3.2 Reusado sem alteração (VERIFIED)

| Bloco | Origem |
| --- | --- |
| `AgentRuntimeService` (loop provider-neutro) | 007.5 |
| `AgentToolCallValidator` (allowlist) | 007.5 |
| `AgentToolBindingResolver` | 007.5 |
| `AgentToolAuthorityEvaluator` (ALLOW/REQUIRE_APPROVAL/DENY) | 007.5 |
| `ActionAuthorization` (single-use) | BE-004 |
| aprovação (pausa/resume via `agent_runtime_checkpoints`) | 007.5 |
| idempotência (chave composta) | 007.5 |
| `ExternalToolExecutor` (único executor) | BE-006 |
| `AgentToolResultSanitizer` + `PromptInjectionGuard` | 007.4 |
| usage por propósito (PRIMARY/TOOL_CONTINUATION/OUTPUT_REPAIR) | 007.5 |
| limites (maximumTurns/toolCalls/callsPerAlias) | 007.5 |

O provider **nunca** resolve credencial de tool, cria aprovação, emite autorização ou executa
tool.

## 4. Gate, capability e produção

- Request com tools exige **não produção** + `ANTHROPIC_TOOL_CALLING_ENABLED` (senão
  `PROVIDER_ERROR`). `toolCallingEnabled() = ANTHROPIC_TOOL_CALLING_ENABLED && !isProduction()`
  (lê `NODE_ENV` ao vivo). Default do env: **false**, honrado só fora de produção.
- Produção sempre lança `MODEL_PROVIDER_DISABLED` **antes** de mapear tools / resolver credencial
  / tocar transporte.
- Catálogo: modelos Anthropic agora declaram capabilities `['STRUCTURED_OUTPUT','TOOL_CALLING']`,
  mas permanecem `DISABLED` / `productionAllowed=false` — capability = **IMPLEMENTADA**, não
  disponível em produção.
- Custo permanece `null` — `COST_RATE_CARD_NOT_AVAILABLE`.

## 5. Invariantes de segurança

1. SDK/provider nunca executam tool; único executor é `ExternalToolExecutor`.
2. Provider nunca resolve credencial de tool, cria aprovação ou emite autorização.
3. Provider nunca decide autoridade (nome desconhecido → runtime recusa `AGENT_TOOL_NOT_ALLOWED`).
4. Definição enviada só tem `name`/`description`/`input_schema`; campos de autoridade/segredo
   nunca cruzam a borda.
5. Descrição e resultado isolados; prompt-injection inspecionado; `REQUIRES_APPROVAL` nunca vira
   `tool_result`; `UNKNOWN` nunca é sucesso.
6. Canary `ARDEN_BE008_ANTHROPIC_TOOL_SECRET_CANARY_<UUID>` provado ausente offline.

Detalhe em `ANTHROPIC_TOOL_CALLING_SECURITY.md`.

## 6. Fora de escopo (out-of-scope)

- chamadas reais à Anthropic (live);
- streaming;
- tool calls paralelas;
- server-side tools da Anthropic;
- MCP;
- subagentes.

## 7. Sem nova superfície persistida

- **Sem** migração (checkpoint/usage/evidência/audit reusados);
- **Sem** endpoint novo; OpenAPI diff-free;
- frontend intocado;
- provider persistido `DISABLED`.

## 8. Estado UNVERIFIED / não executado

- Pricing: **UNVERIFIED**; Data governance: **UNVERIFIED**.
- Live smoke: **NOT EXECUTED**; Live Anthropic tool calling: **NOT EXECUTED** (só
  `FakeAnthropicTransport`).
- Produção: **BLOCKED**.

## 9. DEFERRED para 008.6

Chamada real da Anthropic com tools, streaming, tool calls paralelas, server-side tools, MCP e
subagentes ficam para **008.6** (dependem de reabrir o gate de pricing/governança — hoje
`UNVERIFIED` — antes de rate cards comerciais e `productionAllowed=true`).

## 10. Referências

`ANTHROPIC_TOOL_CALLING_RUNTIME.md`, `ANTHROPIC_TOOL_DEFINITION_MAPPING.md`,
`ANTHROPIC_TOOL_USE_MAPPING.md`, `ANTHROPIC_TOOL_RESULT_MAPPING.md`,
`ANTHROPIC_TOOL_CONTINUATION.md`, `ANTHROPIC_TOOL_CALLING_SECURITY.md`,
`ANTHROPIC_TOOL_CALLING_APPROVALS.md`, `ANTHROPIC_TOOL_CALLING_IDEMPOTENCY.md`,
`ANTHROPIC_TOOL_CALLING_UNKNOWN.md`, `ANTHROPIC_TOOL_CALLING_EVIDENCE.md`, evidência em
`ARDEN_BE_008_ANTHROPIC_TOOL_CALLING_TEST_EVIDENCE.md`.
