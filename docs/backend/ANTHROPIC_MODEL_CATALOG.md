# Catálogo de modelos Anthropic (ARDEN-BE-008.1)

> Contratos verificados. Provider `anthropic.direct` v`1` (connector `system.anthropic`).
> `implementationStatus=CONTRACT_ONLY`, `productionAllowed=false`, `status=DISABLED` —
> provider NÃO executável nesta fase. Fonte única de fatos: `ANTHROPIC_OFFICIAL_SOURCE_REGISTER.md`
> (`@anthropic-ai/sdk@0.115.0`). Nenhum fato fora do registro é afirmado.

## 1. Allowlist FECHADA de modelIds (VERIFIED)

IDs exatos da união `Model` do SDK oficial (v0.115.0). Aliases + snapshots datados:

| Alias | Snapshot datado | Família |
| --- | --- | --- |
| `claude-opus-4-1` | `claude-opus-4-1-20250805` | Opus 4.1 |
| `claude-opus-4-5` | `claude-opus-4-5-20251101` | Opus 4.5 |
| `claude-opus-4-6` | UNVERIFIED | Opus 4.6 |
| `claude-opus-4-7` | UNVERIFIED | Opus 4.7 |
| `claude-opus-4-8` | UNVERIFIED | Opus 4.8 |
| `claude-opus-5` | UNVERIFIED | Opus 5 |
| `claude-sonnet-4-5` | `claude-sonnet-4-5-20250929` | Sonnet 4.5 |
| `claude-sonnet-4-6` | UNVERIFIED | Sonnet 4.6 |
| `claude-sonnet-5` | UNVERIFIED | Sonnet 5 |
| `claude-haiku-4-5` | `claude-haiku-4-5-20251001` | Haiku 4.5 |
| `claude-fable-5` | UNVERIFIED | Fable 5 |
| `claude-mythos-5` | UNVERIFIED | Mythos 5 |
| `claude-mythos-preview` | UNVERIFIED | Mythos preview |

IDs fora desta lista **não são aceitos**. Não inventar aliases nem snapshots.

## 2. Recomendação: fixar snapshot datado (§10 aliases)

Aliases (`claude-opus-4-5`) apontam para o snapshot mais recente da família e **mudam sem
aviso**, quebrando reprodutibilidade de execução/avaliação. A `ModelConfiguration` DEVE
fixar o snapshot datado quando disponível; onde o snapshot é UNVERIFIED, confirmar por
leitura direta (docs 403) antes de habilitar produção. Nunca derivar `modelId` do request.

## 3. Metadados por modelo — UNVERIFIED

`maximumInputTokens` e `maximumOutputTokens` por modelo: **UNVERIFIED (`null`)** — páginas de
docs sob proteção anti-bot (403). Não são afirmados nem chutados. Ficam `null` até
verificação direta em 008.2/008.3; `null` não é 0 nem "ilimitado".

## 4. Capacidades — stance por evidência de API (VERIFIED no nível da API)

Sinais abaixo vêm dos tipos do SDK (v0.115.0), não da doc por modelo:

| Capacidade | Sinal VERIFIED (API-level) | Stance por modelo |
| --- | --- | --- |
| `supportsStructuredOutput` | blocos `tool_use`/`tool_result`, `tools`, `tool_choice` (`auto\|any\|tool\|none`) | assumido via tool/schema; caveat por modelo UNVERIFIED |
| `supportsToolCalling` | `tools`, `tool_choice`, `stop_reason=tool_use` | documentado mas NÃO executável no slice 1 |
| `supportsPromptCaching` | usage `cache_creation_input_tokens`, `cache_read_input_tokens`, `cache_creation` | disponível na API; suporte/limite por modelo UNVERIFIED |
| `supportsStreaming` | param `stream?` em `messages.create` | disponível na API; sem caveat por modelo |

Capacidade no slice 1 = **STRUCTURED_OUTPUT apenas**. Tool calling permanece contrato, não
runtime (`COMMERCIAL_PROVIDER_TOOL_CALLING.md`).

## 5. PROIBIDO (fonte do modelId)

- `modelId` arbitrário/livre ou fora da allowlist → rejeição (`MODEL_PROVIDER_NOT_AVAILABLE`);
- `modelId` vindo do request/step de execução (deve vir da `ModelConfiguration`);
- `modelId` de outro provider (cross-provider);
- modelo `DEPRECATED` sem fonte oficial — deprecação exige leitura direta, não memória.
