# Anthropic — registro de fontes oficiais (ARDEN-BE-008.1)

Registro de cada dado externo usado na decisão/contratos, com fonte, forma de acesso, data,
informação suportada, confiança e impacto. Data de acesso: **2026-08-03**. Nenhuma requisição
foi enviada à API da Anthropic; nenhuma key real usada.

## Nível de confiança

- **VERIFIED** — lido diretamente de fonte oficial machine-readable (registry npm oficial ou
  definições de tipo `.d.ts` do pacote oficial publicado `@anthropic-ai/sdk`).
- **PENDING_DIRECT** — proveniente de busca restrita ao domínio oficial `anthropic.com`, mas a
  página não pôde ser lida diretamente (Cloudflare 403 no fetch automatizado); exige
  confirmação por leitura direta antes de 008.2.
- **UNVERIFIED** — depende de páginas de documentação atrás de proteção anti-bot (403); não
  afirmado como requisito atendido.

## VERIFIED — pacote e runtime

| Dado | Valor | Fonte | Acesso |
| --- | --- | --- | --- |
| Pacote SDK TS oficial | `@anthropic-ai/sdk` | registry.npmjs.org (API JSON oficial) | 2026-08-03 |
| Versão estável | **0.115.0** (publicada 2026-07-24) | registry.npmjs.org/@anthropic-ai/sdk/latest | 2026-08-03 |
| Licença / tipos | MIT · TypeScript nativo (`./index.d.ts`) | packument oficial | 2026-08-03 |
| TypeScript suportado | ≥ 4.9 | README oficial (packument) | 2026-08-03 |
| Runtimes | Node.js 20 LTS+, Deno ≥1.28, Bun ≥1.0, Cloudflare Workers, Vercel Edge | README oficial | 2026-08-03 |
| Repo oficial | github.com/anthropics/anthropic-sdk-typescript | homepage do packument | 2026-08-03 |

## VERIFIED — transporte e cliente (defaults do SDK)

| Dado | Valor | Fonte |
| --- | --- | --- |
| Base URL oficial | `https://api.anthropic.com` (env `ANTHROPIC_BASE_URL`) | `.d.ts` do cliente (v0.115.0) |
| Timeout default | 10 minutos | `.d.ts` do cliente |
| maxRetries default | 2 | `.d.ts` do cliente |
| Retry de timeout | timeouts são retriados por default | `.d.ts` do cliente |
| API de mensagens | `client.messages.create({ model, max_tokens, messages, ... })` | `.d.ts` de resources/messages |
| Params de request | model, max_tokens, messages, system?, temperature?, top_p?, top_k?, stop_sequences?, tools?, tool_choice?, metadata?, stream?, thinking?, service_tier? | `.d.ts` de messages |
| tool_choice | `auto \| any \| tool \| none` | `.d.ts` de messages |
| Blocos de conteúdo | `text`, `tool_use`, `tool_result`, `thinking` | `.d.ts` de messages |

## VERIFIED — finish reasons (StopReason)

`end_turn` · `max_tokens` · `stop_sequence` · `tool_use` · `pause_turn` · `refusal` ·
`model_context_window_exceeded`. Fonte: `resources/messages/messages.d.ts` (v0.115.0).

## VERIFIED — usage (Usage)

`input_tokens` · `output_tokens` · `cache_creation_input_tokens` (escrita de cache) ·
`cache_read_input_tokens` (leitura de cache) · `cache_creation` (breakdown por TTL) ·
`service_tier` (`standard\|priority\|batch\|null`) · `inference_geo` (`string\|null`).
Fonte: `resources/messages/messages.d.ts` (v0.115.0).

## VERIFIED — classes de erro do SDK

`AnthropicError` · `APIError` · `APIUserAbortError` · `APIConnectionError` ·
`APIConnectionTimeoutError` · `RetryableError` · `BadRequestError` (400) ·
`AuthenticationError` (401) · `PermissionDeniedError` (403) · `NotFoundError` (404) ·
`ConflictError` (409) · `UnprocessableEntityError` (422) · `RateLimitError` (429) ·
`InternalServerError` (5xx). Fonte: `core/error.d.ts` (v0.115.0).

## VERIFIED — IDs de modelo (união `Model` do SDK)

Aliases + snapshots datados, exatos da união oficial (v0.115.0):
`claude-opus-4-1` (`-20250805`) · `claude-opus-4-5` (`-20251101`) · `claude-opus-4-6` ·
`claude-opus-4-7` · `claude-opus-4-8` · `claude-opus-5` · `claude-sonnet-4-5` (`-20250929`) ·
`claude-sonnet-4-6` · `claude-sonnet-5` · `claude-haiku-4-5` (`-20251001`) · `claude-fable-5` ·
`claude-mythos-5` · `claude-mythos-preview`. Fonte: `resources/messages/messages.d.ts`.
IDs não listados aqui não são aceitos (allowlist fechada). Não inventar aliases.

## PENDING_DIRECT — preços (busca em anthropic.com; página não lida diretamente)

Busca restrita a `anthropic.com` retornou a página oficial de preços
(`docs.anthropic.com/en/docs/about-claude/pricing`) e sinais de preço por milhão de tokens
(ordem de grandeza: Opus 5 ~US$5/US$25; Sonnet 5 introdutório ~US$2/US$10 até 2026-08-31 depois
~US$3/US$15; Haiku 4.5 ~US$1/US$5). O resumo de busca **misturou o mapeamento por família** e a
página não pôde ser lida diretamente (Cloudflare 403). Portanto **nenhum preço é gravado como
autoritativo** nos rate cards nesta fase — ver `ANTHROPIC_RATE_CARDS.md`. Confirmar por leitura
direta antes de 008.2. Não é permitido inventar preço.

## UNVERIFIED — exigem leitura direta (docs 403) antes de 008.2/008.3

Limites de tokens (input/output) por modelo; disponibilidade de prompt caching/vision por
modelo; limites de rate específicos; retenção de dados; uso de dados para treinamento;
zero-data-retention; regiões/data residency; DPA; sub-processadores; políticas enterprise.
Nenhum destes é afirmado como atendido. Ver `ANTHROPIC_DATA_GOVERNANCE_VERIFIED.md`.

## Fontes NÃO usadas como decisão

Blogs, agregadores, Stack Overflow, Reddit, tutoriais, posts de terceiros, snippets não
oficiais e memória interna não verificada — nenhum foi usado como base decisória.
