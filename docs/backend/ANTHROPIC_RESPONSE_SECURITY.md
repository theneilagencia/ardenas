# Anthropic — segurança da response do provider (ARDEN-BE-008.3)

> Mapeamento da response para o domínio, com finish reasons normalizados e sem tratar vazio /
> desconhecido como sucesso. Reusa a tabela verificada do 008.1
> (`ANTHROPIC_REQUEST_RESPONSE_MAPPING.md`, `ANTHROPIC_USAGE_MAPPING.md`). Fonte:
> `anthropic-response-mapper.ts`.

## 1. Finish reason (VERIFIED)

Reusa a tabela de `stop_reason` verificada. Regra específica desta fatia:

| `stop_reason` | `finishReason` Arden | Observação |
| --- | --- | --- |
| `end_turn` | `STOP` | — |
| `max_tokens` | `MAX_TOKENS` | — |
| `stop_sequence` | `STOP` | — |
| `tool_use` (tool sintética `arden_structured_output`) | **`STOP`** | structured output; **não** `TOOL_CALL` |
| `refusal` | `CONTENT_FILTER` | não-retryável |
| `pause_turn` / `model_context_window_exceeded` | conforme tabela verificada | — |

O `tool_use` da tool sintética é normalizado para `STOP` para que a saída estruturada **não**
seja roteada para o pipeline de tools (não há tool call real nesta fatia).

## 2. Só blocos de conteúdo esperados

O mapper aceita **apenas** os blocos previstos (`text`, e o `tool_use` da tool sintética). Um
bloco inesperado, resposta vazia ou sem output estruturado válido:

- **nunca** vira sucesso silencioso;
- resposta ambígua/ilegível após envio → `MODEL_RESULT_UNKNOWN` (ver
  `ANTHROPIC_RUNTIME_ERRORS.md` / `ANTHROPIC_RUNTIME_RETRY.md`), nunca sucesso, nunca retry
  cego.

## 3. Usage (VERIFIED)

Reusa `ANTHROPIC_USAGE_MAPPING.md`:

- `input_tokens` → input; `output_tokens` → output;
- `cache_read_input_tokens` → `cachedInputTokens`;
- `durationMs` medido **pelo provider** (não vem do wire);
- `modelCallCount` = número de tentativas.

Custo: sem rate card verificado → `estimatedCostMinor=null`, `currency=null`, warning
`COST_RATE_CARD_NOT_AVAILABLE`, **nunca zero**.

## 4. `providerRequestId` só como hash

Quando existe um id de request do provider, ele é persistido **apenas como hash** na evidência
(recorder BE-007.6), nunca em claro. O corpo bruto da response não é persistido; guardamos
hashes de output/schema do output ACEITO (ver structured output runtime).

## 5. NUNCA

- rotear a tool sintética para o pipeline de tools (`finishReason` é `STOP`);
- aceitar bloco inesperado / resposta vazia como sucesso;
- tratar resultado incerto como sucesso ou retriá-lo cegamente;
- persistir `providerRequestId` em claro ou o corpo bruto da response;
- fabricar usage ou gravar custo zero.
