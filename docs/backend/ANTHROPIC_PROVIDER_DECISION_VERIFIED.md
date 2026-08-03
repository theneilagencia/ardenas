# Decisão técnica final do provider Anthropic — verificada (ARDEN-BE-008.1)

Este documento converte a **recomendação** da auditoria 008
(`COMMERCIAL_MODEL_PROVIDER_DECISION.md`) em uma **decisão técnica verificável**, sustentada
apenas por fontes oficiais machine-readable (ver `ANTHROPIC_OFFICIAL_SOURCE_REGISTER.md`).
Nenhuma requisição foi enviada à API da Anthropic; nenhuma key real foi usada; nenhum SDK foi
instalado. O provider permanece **NÃO executável** (`CONTRACT_ONLY` / `DISABLED`).

## 1. Decisão

**Provider inicial: Anthropic Claude via API direta (`https://api.anthropic.com`).**
Chave canônica `anthropic.direct`, versão `1`, conector de sistema `system.anthropic`.

Status de confiança: **CONDITIONALLY_CONFIRMED**.
- **Arquitetura e contrato de transporte**: confirmados por fonte oficial (VERIFIED).
- **Preços e governança de dados**: NÃO verificáveis por leitura direta nesta sessão
  (docs.anthropic.com retorna Cloudflare 403 em fetch automatizado) → PENDING_DIRECT /
  UNVERIFIED. Nenhum preço/retenção afirmado como requisito atendido. Confirmar antes de 008.2.

A decisão continua não sendo automática por afinidade: ela sobrevive à comparação arquitetural
da auditoria (menor acoplamento, uma superfície operacional, sem gateway externo, sem
multi-provider prematuro) **e** agora está ancorada em fatos oficiais do SDK.

## 2. O que ficou VERIFICADO (fonte oficial)

Todos os itens abaixo vêm do registry npm oficial e das definições `.d.ts` do pacote oficial
publicado `@anthropic-ai/sdk@0.115.0` (2026-07-24, MIT). Ver o registro de fontes para o
detalhamento célula a célula.

- **SDK oficial e runtime**: `@anthropic-ai/sdk@0.115.0`, TypeScript nativo, Node 20 LTS+.
- **Transporte**: base URL `https://api.anthropic.com`; timeout default 10 min; maxRetries
  default 2; timeouts retriados por default. Nossos contratos travam a base URL em `OFFICIAL`
  (sem override arbitrário) e definem política de retry própria e conservadora.
- **API Messages**: `model`, `max_tokens`, `messages`, `system?`, `temperature?`, `top_p?`,
  `top_k?`, `stop_sequences?`, `tools?`, `tool_choice?`, `metadata?`, `stream?`, `thinking?`,
  `service_tier?`. `tool_choice ∈ {auto, any, tool, none}`. Blocos: `text`, `tool_use`,
  `tool_result`, `thinking`.
- **StopReason** (7): `end_turn`, `max_tokens`, `stop_sequence`, `tool_use`, `pause_turn`,
  `refusal`, `model_context_window_exceeded`.
- **Usage**: `input_tokens`, `output_tokens`, `cache_creation_input_tokens`,
  `cache_read_input_tokens`, `cache_creation`, `service_tier`, `inference_geo`.
- **Erros** (14 classes): `AnthropicError` … `BadRequestError`(400), `AuthenticationError`(401),
  `PermissionDeniedError`(403), `NotFoundError`(404), `ConflictError`(409),
  `UnprocessableEntityError`(422), `RateLimitError`(429), `InternalServerError`(5xx),
  `APIConnectionError`, `APIConnectionTimeoutError`, `APIUserAbortError`, `RetryableError`.
- **IDs de modelo**: união `Model` fechada e datada (opus 4-1/4-5/4-6/4-7/4-8/5, sonnet
  4-5/4-6/5, haiku 4-5, fable-5, mythos-5/preview + snapshots datados). O catálogo do Arden usa
  **apenas snapshots datados** (reprodutibilidade) e é uma **allowlist fechada**.

## 3. O que ficou PENDENTE (não afirmado como atendido)

- **Preços por modelo** (PENDING_DIRECT): a busca restrita a `anthropic.com` retornou a página
  oficial de pricing, mas o resumo **misturou o mapeamento por família** e a página não pôde ser
  lida diretamente. Portanto os rate cards nascem **vazios** e nenhum preço é gravado. Custo
  desconhecido → `null` + código canônico, **nunca zero** (regra herdada do BE-007.6).
- **Governança de dados** (UNVERIFIED): retenção, uso para treinamento, zero-data-retention,
  regiões/residency, DPA, sub-processadores — atrás de páginas com anti-bot (403). Não afirmados.
  Ver `ANTHROPIC_DATA_GOVERNANCE_VERIFIED.md`.
- **Limites de token por modelo** (UNVERIFIED): `maximumInputTokens`/`maximumOutputTokens` do
  catálogo ficam `null` até leitura direta.

## 4. Fronteiras de política (armadilhas evitadas)

- **API direta ≠ Bedrock**: nenhuma política/credencial/região de AWS Bedrock foi aplicada à API
  direta. Credencial é **API key → vault BE-006**; base URL é a oficial da Anthropic.
- **API direta ≠ Claude.ai**: nenhuma política de produto de consumo (Claude.ai) foi aplicada à
  API. Afirmações de governança da API exigem fonte específica da API — que ficou UNVERIFIED.
- **Sem modelId/baseURL arbitrário**: request de execução **nunca** escolhe `modelId`; ele vem da
  configuração allowlisted. Base URL travada em `OFFICIAL`.

## 4b. Estado após 008.2 (persistência administrativa)

O gate 008.2A reexecutou a verificação oficial e confirmou **PRICING_STATUS = UNVERIFIED** e
**DATA_GOVERNANCE_STATUS = UNVERIFIED** (todas as páginas 403). O 008.2B, portanto, entregou
apenas a **infraestrutura administrativa** (conector `system.anthropic`, provider
`anthropic.direct` e catálogo de modelos **persistidos como DISABLED**, credencial tenant-managed
no cofre, validação local, lifecycle de `ModelConfiguration` com ativação bloqueada). Rate cards
comerciais permanecem **vazios**. A decisão continua **CONDITIONALLY_CONFIRMED** — sem execução.

## 4c. Estado após 008.3 (provider executável atrás de gate)

O 008.3 tornou o provider **executável em runtime**, mas **apenas atrás de feature gate de
teste/desenvolvimento** e **sem nenhuma chamada externa real** (SDK pinado e isolado, transporte
real gated na rede, testes offline com transporte fake). O provider persistido permanece
**`DISABLED`** / `productionAllowed=false`; o registro no runtime é condicional
(`RUNTIME_ENABLED && NODE_ENV !== 'production'`) e a produção continua bloqueada. A decisão segue
**CONDITIONALLY_CONFIRMED**: nenhuma chamada externa ocorreu e governança/preços permanecem
UNVERIFIED. Ver `ANTHROPIC_RUNTIME_FEATURE_GATES.md` e
`../implementation/ARDEN_BE_008_ANTHROPIC_RUNTIME_REPORT.md`.

## 4d. Estado após 008.4 (smoke test real + habilitação restrita)

O 008.4 entregou a **infraestrutura de smoke test real controlado** e a **habilitação restrita
não produtiva** (gate + quotas + circuit breaker + binding do smoke à versão de credencial), mas a
**chamada real NÃO foi executada** (008.4C): sem credencial oficial de teste, sem documentos
oficiais (gate 008.4A = **Resultado B**: `PRICING_STATUS=UNVERIFIED`,
`DATA_GOVERNANCE_STATUS=UNVERIFIED`; 0 documentos; 403 reconfirmado 2026-08-03). O caminho real
está provado **offline** (fake transport). Provider persistido permanece **`DISABLED`** /
`productionAllowed=false`; produção continua bloqueada (agora em 4 pontos). A decisão segue
**CONDITIONALLY_CONFIRMED** — nenhuma chamada externa ocorreu, pricing/governança seguem
UNVERIFIED. Ver `ANTHROPIC_NON_PROD_ENABLEMENT.md`, `ANTHROPIC_LIVE_SMOKE_TEST.md` e
`../implementation/ARDEN_BE_008_NON_PROD_ENABLEMENT_REPORT.md`.

## 5. Consequência para 008.2 (gate)

Antes de habilitar execução (008.2+): (a) ler diretamente a página oficial de pricing e
preencher rate cards versionados; (b) ler diretamente a política de dados/retention da API e
registrar em `ANTHROPIC_DATA_GOVERNANCE_VERIFIED.md`; (c) confirmar limites de token por modelo.
Só então `status`/`productionAllowed` do provider e dos modelos poderão mudar. Enquanto qualquer
um desses ficar pendente, o provider permanece `DISABLED`.
