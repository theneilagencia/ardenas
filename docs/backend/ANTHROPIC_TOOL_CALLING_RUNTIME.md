<!-- Milestone: ARDEN-BE-008.5 — Anthropic tool calling (validado OFFLINE apenas) -->
# Anthropic — runtime de tool calling (ARDEN-BE-008.5)

> O provider Anthropic apenas **traduz** definições de tools e `tool_use` na borda; quem
> valida, resolve binding, avalia autoridade, aprova, autoriza, executa e isola o resultado é
> o `AgentRuntimeService` provider-neutro (007.5). O modelo **propõe**; o servidor **decide e
> executa**. Fonte: `anthropic-model-provider.ts` + mappers puros da Fatia 2.

Status desta fatia:
- Tool calling implementation: **OFFLINE VERIFIED**
- Live Anthropic tool calling: **NOT EXECUTED**
- Production: **BLOCKED**

## 1. Regra de segurança central

O provider (e o SDK oficial Anthropic v0.115.0) **NUNCA** decide autoridade nem executa tools.
Ele converte formatos entre o modelo de domínio Arden e a API Anthropic. Toda decisão de
segurança e todo efeito externo ficam no runtime provider-neutro. Isso é invariante e vale em
todas as seções abaixo.

## 2. Fluxo completo (OFFLINE VERIFIED)

```
AgentRuntimeService (007.5, provider-neutro)
  → provider.generate(request, context)         [ANTHROPIC_TOOL_CALLING_ENABLED && !prod]
      → anthropic-tool-definition-mapper         ModelToolDefinition[] → {name,description,input_schema}
      → anthropic-request-mapper                 tools[] + tool_choice + (structured output)
      → AnthropicTransport                        (FakeAnthropicTransport — offline nesta fatia)
      ← response com stop_reason=tool_use
      → anthropic-response-mapper                 reverse-alias (codec) → ModelToolCall (finishReason TOOL_CALL)
  ← ModelToolCall
  → AgentToolCallValidator                        alias permitido? (senão AGENT_TOOL_NOT_ALLOWED)
  → AgentToolBindingResolver                      alias → binding concreto
  → AgentToolAuthorityEvaluator                   ALLOW | REQUIRE_APPROVAL | DENY
  → ActionAuthorization                           (single-use, só no caminho ALLOW/aprovado)
  → [REQUIRE_APPROVAL] pausa → agent_runtime_checkpoints → resume
  → ExternalToolExecutor (BE-006)                 ÚNICO caminho de execução
  → AgentToolResultSanitizer + PromptInjectionGuard (007.4)  isolamento do resultado
  → anthropic-tool-result-mapper                  AgentToolCallResult → tool_result block
  → continuação (assistant tool_use + user tool_result) → novo generate
  → ... até structured output final
```

## 3. Papéis por camada

| Camada | Responsabilidade | Decide autoridade? | Executa tool? |
| --- | --- | --- | --- |
| SDK oficial Anthropic v0.115.0 | transporte HTTP (isolado atrás de porta) | NÃO | NÃO |
| Provider Anthropic | tradução de definição/`tool_use`/`tool_result` | NÃO | NÃO |
| `AgentToolCallValidator` | alias permitido | valida allowlist | NÃO |
| `AgentToolAuthorityEvaluator` | ALLOW/REQUIRE_APPROVAL/DENY | SIM | NÃO |
| `ActionAuthorization` | autorização single-use | emite autorização | NÃO |
| `ExternalToolExecutor` (BE-006) | efeito externo | NÃO | **SIM (único)** |
| Sanitizer + PromptInjectionGuard (007.4) | isolamento do resultado | NÃO | NÃO |

## 4. O que o provider recebe e devolve

- Recebe `ModelToolDefinition[]` do runtime e mapeia para `{name, description, input_schema}`
  (ver `ANTHROPIC_TOOL_DEFINITION_MAPPING.md`).
- Devolve `ModelToolCall` com `finishReason = TOOL_CALL` quando `stop_reason = tool_use`
  (ver `ANTHROPIC_TOOL_USE_MAPPING.md`).
- Recebe `AgentToolCallResult` (já isolado pelo runtime) e mapeia para um bloco `tool_result`
  Anthropic (ver `ANTHROPIC_TOOL_RESULT_MAPPING.md`).
- A continuação sintetiza histórico canônico (ver `ANTHROPIC_TOOL_CONTINUATION.md`).

## 5. Structured output no loop de tools

- Sem tools reais: structured output permanece uma tool sintética **forçada**
  `arden_structured_output` (comportamento herdado da Fatia 1).
- Com tools reais: `tool_choice = AUTO` com ambas presentes (tools reais + tool sintética).
- A estratégia interna de `tool_choice` (`AUTO`/`NONE`/`REQUIRED`) é **sempre interna** — nunca
  derivada do request externo. `REQUIRED` mapeia para Anthropic `{type:'any'}` e existe
  apenas em fixtures.

## 6. Gate e produção

- Quando o request tem tools, exige ambiente **não produtivo** + gate
  `ANTHROPIC_TOOL_CALLING_ENABLED` (senão `PROVIDER_ERROR`).
- Produção **sempre** lança `MODEL_PROVIDER_DISABLED` **antes** de mapear tools, resolver
  credencial ou tocar o transporte.
- `toolCallingEnabled() = ANTHROPIC_TOOL_CALLING_ENABLED && !isProduction()` (lê `NODE_ENV`
  ao vivo). Default de `ANTHROPIC_TOOL_CALLING_ENABLED`: **false**, honrado só fora de produção.

## 7. Custo

Custo permanece `null` — `COST_RATE_CARD_NOT_AVAILABLE` (sem rate card verificado).

## 8. O que o provider NUNCA faz (PROIBIDO)

- resolver credencial de tool, criar aprovação, emitir `ActionAuthorization` ou executar tool;
- decidir autoridade a partir de qualquer campo do request ou da resposta do modelo;
- ramificar o runtime por provider (`if provider === 'anthropic'`);
- enviar tools reais em produção ou sem o gate não produtivo;
- re-persistir input cru do modelo na continuação.

## 9. Estado

Tool calling implementation: **OFFLINE VERIFIED** (via `FakeAnthropicTransport`). Live Anthropic
tool calling: **NOT EXECUTED**. Production: **BLOCKED**.
