<!-- Milestone: ARDEN-BE-008.5 — Anthropic tool calling (validado OFFLINE apenas) -->
# ARDEN-BE-008.5 — evidência de teste: tool calling Anthropic (OFFLINE)

> Classificação: **OFFLINE VERIFIED**. Cobertura por testes unitários dos mappers puros +
> cenários do fake transport + um spec de integração offline E2E. **Nenhum** teste live foi
> executado (`FakeAnthropicTransport` apenas). A maior parte da matriz §41/§42 é coberta por
> reuso dos testes do runtime provider-neutro 007.5.

Status desta fatia:
- Tool calling implementation: **OFFLINE VERIFIED**
- Live Anthropic tool calling: **NOT EXECUTED**
- Production: **BLOCKED**

## 1. Classificação

| Dimensão | Status |
| --- | --- |
| Unit (mappers/codec/guard) | **OFFLINE VERIFIED** |
| Cenários fake transport | **OFFLINE VERIFIED** |
| Integração E2E offline | **OFFLINE VERIFIED** |
| Live Anthropic tool calling | **NONE / NOT EXECUTED** |
| Produção | **BLOCKED** |

## 2. Testes unitários — `anthropic-tool-calling.spec.ts`

| Alvo | Verifica |
| --- | --- |
| codec (`AnthropicToolNameCodec`) | mapa determinístico/reversível por request; padrão `^[a-zA-Z0-9_-]{1,64}$`; colisão-safe; reservados → `arden_t_<sha256[:24]>` |
| definition mapper | só `name`/`description`/`input_schema`; campos proibidos nunca saem; `assertAnthropicSchemaCompatible` rejeita `$ref`/depth>12/props>200/tamanho → `AGENT_TOOL_SCHEMA_INVALID` |
| description guard | limite 500, NFC, redação, injection (007.4), rejeição de credencial → `AGENT_TOOL_DESCRIPTION_REJECTED`, hash sha256 |
| result mapper | SUCCEEDED→`is_error=false` sanitizado; FAILED/DENIED/UNKNOWN→`is_error=true`; DENIED mínimo; UNKNOWN nunca sucesso; REQUIRES_APPROVAL lança; clamp 8000; `tool_use_id` preservado |
| request mapper | tools[]+tool_choice; structured output (tool sintética forçada sem tools reais, AUTO com ambas); estratégia interna AUTO/NONE/REQUIRED; continuação (assistant tool_use + user tool_result, input mínimo) |
| response mapper | reverse-alias; desconhecido mantido cru; `tool_use.id` capado 120; `stop_reason=tool_use`→`TOOL_CALL` |

## 3. Cenários do fake transport (offline)

`anthropic-fake-transport.ts`:

- `tool_use_then_output`
- `tool_invalid_alias`
- `tool_invalid_input`
- `tool_multiple_calls`
- `tool_repeat_forever`
- `model_unknown_after_tool`

## 4. Integração offline — `anthropic-tool-calling.integration.spec.ts`

E2E automático via `FakeAnthropicTransport`:

| Caso | Resultado esperado |
| --- | --- |
| `tool_use` READ → continuação → SUCCEEDED | fluxo completo até resultado bem-sucedido |
| tool desconhecida | `AGENT_TOOL_NOT_ALLOWED` (runtime recusa; provider não decide) |
| bloqueio de produção | `MODEL_PROVIDER_DISABLED` **com transporte não chamado** |
| canary de segredo | `ARDEN_BE008_ANTHROPIC_TOOL_SECRET_CANARY_<UUID>` **ausente** no payload de borda |

## 5. Live

**NENHUM** teste live. Live Anthropic tool calling: **NOT EXECUTED**. Live smoke: **NOT
EXECUTED**. Toda validação usou `FakeAnthropicTransport`.

## 6. Reuso da matriz 007.5

A matriz §41/§42 (validação, binding, autoridade, aprovação, autorização single-use,
idempotência, execução única, isolamento, usage, limites) é largamente coberta pelo **reuso dos
testes do runtime provider-neutro 007.5** — o provider Anthropic entra provider-neutro e não
reimplementa esse comportamento.

## 7. Estado

Tool calling implementation: **OFFLINE VERIFIED**. Live Anthropic tool calling: **NOT
EXECUTED**. Production: **BLOCKED**.
