# ARDEN-BE-008 — Plano de implementação (Commercial Model Provider Integration)

Plano derivado da auditoria (`ARDEN_BE_008_PROVIDER_SCOPE_AUDIT.md`). Provisório: o nome é
"ARDEN-BE-008 — Commercial Model Provider Integration"; a divisão em fases é uma proposta, não
um compromisso de oito fases. Documento de planejamento — nenhum código nesta etapa.

## 1. Objetivo mínimo

Integrar o PRIMEIRO provider comercial (Anthropic Claude, API direta) reutilizando runtime,
vault, conexões, tool calling, avaliação, usage/custo e observabilidade já existentes — com a
menor superfície nova possível: um adapter + connector definition + catálogo/rate cards +
ajustes mínimos de frontend.

## 2. Capabilities do primeiro slice

Somente **STRUCTURED_OUTPUT** e **TOOL_CALLING** são candidatas ao milestone. Fases posteriores:
STREAMING, VISION, PROMPT_CACHING, BATCH, FILES, COMPUTER_USE. Não ampliar o slice só porque o
provider suporta.

Decisão de sequenciamento: **structured output e tool calling em fatias separadas.** O primeiro
slice entrega structured output SEM tool calling (menor risco: sem autoridade/aprovação/execução
externa no caminho crítico do provider novo). Tool calling entra numa segunda fatia, reusando
integralmente BE-004/005/006 já validados.

## 3. Fatias verticais

**Fatia 1 (structured output):** criar connection do provider → armazenar credencial no vault →
testar credencial → ativar connection → criar model configuration (modelId allowlisted) →
publicar agent version → executar operação (`agent.execute`) → enviar contexto redigido ao
provider → receber structured output → validar server-side → persistir usage e custo → consultar
resultado. Funciona sem tool calling.

**Fatia 2 (tool calling):** habilita o modelo a propor `ModelToolCall`; servidor valida alias,
resolve binding (BE-006), avalia autoridade (BE-004), executa (`ExternalToolExecutor`),
aprova/suspende/retoma (BE-004/005). Nenhuma execução no adapter; nenhum segredo ao provider.

## 4. Fases candidatas (consolidar quando seguro)

| Fase | Escopo |
| --- | --- |
| 008.1 | Decisão do provider (feito nesta auditoria), contratos mínimos, catálogo de modelos (shape) |
| 008.2 | Connection + credenciais (vault BE-006) + model allowlist + rate cards comerciais (preços verificados) |
| 008.3 | Adapter do provider + structured output (Fatia 1) — sem tool calling |
| 008.4 | Tool calling normalizado (Fatia 2) |
| 008.5 | Erros, retries, usage e observabilidade do provider |
| 008.6 | Frontend (connection/one-time key/teste/ativação/model config/custo) + fecho do vertical slice |
| 008.7 | Hardening, smoke test controlado e PR |

Consolidações seguras prováveis: 008.1+008.2 (decisão + catálogo + credencial são coesos);
008.5 pode nascer junto de 008.3/008.4 (usage/erros são parte do adapter). A divisão final é
decidida no início da implementação, não aqui.

## 5. Credenciais (resumo — detalhe em COMMERCIAL_PROVIDER_CREDENTIAL_MODEL.md)

Estratégia inicial recomendada: **tenant-managed** (cada organização fornece sua API key).
Credencial via SecretVault + credential versions + rotação + revogação + resolução server-side,
reutilizando `organization_connections`/`connection_credential_versions` (BE-006), apontada por
`ModelConfiguration.credentialConnectionId`. Sem cofre paralelo; nunca no frontend/parameters/env
global/prompt/job/evidence/audit. Platform-managed fica como opção de fase posterior (monetização).

## 6. Testabilidade (detalhe em COMMERCIAL_PROVIDER_TEST_STRATEGY.md)

Três camadas: unit com SDK mockado; integração local com fake HTTP/transport (sem internet);
smoke test controlado (credencial real, desabilitado por default, fora do PR público, custo
controlado, sem dados reais de cliente). A suíte normal nunca depende da internet.

## 7. Itens explicitamente adiados

Multi-provider fallback; routing dinâmico; provider marketplace; streaming; vision; arquivos;
batch; prompt caching avançado; computer use; fine-tuning; embeddings; RAG; avaliação por LLM;
model gateway; billing/compra de créditos; bring-your-own-model endpoint.

## 8. Pré-condições de implementação (verificação externa)

Antes de 008.2/008.3, confirmar e registrar (com fonte): SDK TS oficial; IDs de modelo + limites;
preços por modelo (input/output/cached); regiões/data residency; retenção e política de
treinamento; DPA + sub-processadores; enterprise controls; quotas/rate limits. Nenhum preço ou
fato externo é assumido neste plano.

## 9. Restrições de conformidade (herdadas do BE-007)

`modelId` só do catálogo allowlisted (nunca do request/etapa); structured output inválido e
UNKNOWN nunca viram sucesso; custo em inteiro (ausente≠zero); avaliação final determinística;
multitenancy (sem cruzar tenant); nenhum segredo/prompt persistido; execução só via `agent.execute`
(sem endpoint direto, sem chat). O provider comercial não relaxa nenhuma dessas invariantes.

## Atualização 008.2

**008.2A (gate de verificação oficial)** — pricing e governança de dados oficiais retornaram 403
(Cloudflare): `PRICING_STATUS=UNVERIFIED`, `DATA_GOVERNANCE_STATUS=UNVERIFIED` (bloqueante) →
**Resultado B (insuficiente)**. Consequência: prosseguir apenas com infraestrutura administrativa,
sem rate cards comerciais, com provider/modelos `DISABLED`. Detalhe em
`ARDEN_BE_008_EXTERNAL_VERIFICATION_GATE.md`.

**008.2B (infraestrutura administrativa)** — entregue o ciclo administrativo reusando BE-006/BE-007:
connector `system.anthropic` + connection + credencial no vault (AES-256-GCM, rotação/revogação) +
catálogo de modelos persistido (`model_catalog_entries`, migração aditiva) + ciclo de vida de
`ModelConfiguration` (DRAFT preparável, ativação bloqueada). Validação **local** de configuração
(`NOT_VERIFIED_WITH_PROVIDER`, nunca contata o provider). Provider `anthropic.direct` e 3 modelos
permanecem **`DISABLED`**; sem SDK, sem chamada real, sem endpoint de execução. Relatório em
`ARDEN_BE_008_CONNECTIONS_REPORT.md`; evidência em `ARDEN_BE_008_CONNECTIONS_TEST_EVIDENCE.md`.

**Próximo: 008.3** — instalação controlada do SDK + provider executável em ambiente restrito
(structured output, Fatia 1), condicionado à reabertura do gate (verificação direta de pricing e
governança).

## Atualização 008.3

Provider `anthropic.direct@1` tornado **executável em runtime**, porém **apenas atrás de feature
gate de teste/desenvolvimento** e **sem nenhuma chamada externa real**. SDK oficial instalado e
pinado (`@anthropic-ai/sdk@0.115.0`, exato), isolado atrás de uma porta de transporte; transporte
real gated na rede; transporte fake offline para os testes; `AnthropicModelProvider` (structured
output, Fatia 1) integrado de forma provider-neutra; registro condicional
(`RUNTIME_ENABLED && !production`); produção bloqueada em 3 pontos. Provider persistido permanece
`DISABLED`; **sem migração**, OpenAPI diff-free; pricing/governança seguem **UNVERIFIED**.
Detalhe em `ARDEN_BE_008_ANTHROPIC_RUNTIME_REPORT.md` + evidência em
`ARDEN_BE_008_ANTHROPIC_RUNTIME_TEST_EVIDENCE.md`.

**Próximo: 008.4** — verificação oficial **manual** de pricing e governança de dados +
**smoke test real controlado** (credencial real, custo controlado, fora do PR público, sem dados
reais de cliente) + habilitação restrita; só então rate cards comerciais e ativação em produção.

## Atualização 008.4

Quatro gates sequenciais (detalhe em `ARDEN_BE_008_LIVE_SMOKE_REPORT.md`):

- **008.4A (verificação oficial manual/por documentos)** — **Resultado B (insuficiente)**: 0
  documentos oficiais recebidos, páginas oficiais 403 reconfirmado (2026-08-03) →
  `PRICING_STATUS=UNVERIFIED`, `DATA_GOVERNANCE_STATUS=UNVERIFIED`. Nenhum rate card criado.
- **008.4B (infraestrutura de smoke test)** — **PASS**: CLI admin `npm run smoke:anthropic`
  (fora das suítes normais/CI), guardada por múltiplos flags + confirmação explícita; credencial
  só do cofre; payload sintético fixo; caminho real sem bypass; resultado sanitizado. Provado
  offline (fake transport).
- **008.4C (smoke test real)** — **NOT EXECUTED**: sem credencial oficial de teste, sem
  documentos oficiais, sem confirmação de operador. Nenhuma chamada real. Caminho fica para o
  operador com credencial legítima.
- **008.4D (habilitação restrita não produtiva)** — **PASS**: `AnthropicNonProdGate` (não
  produção via `NODE_ENV` ao vivo + org allowlist server-side + circuit breaker + quotas), binding
  do smoke à versão de credencial, rotação invalida smoke. Provider persistido segue `DISABLED`;
  **sem migração**, sem endpoint novo, OpenAPI diff-free; frontend não alterado. Produção
  bloqueada em 4 pontos → `MODEL_PROVIDER_DISABLED`.

Detalhe em `ARDEN_BE_008_NON_PROD_ENABLEMENT_REPORT.md` + evidência em
`ARDEN_BE_008_LIVE_SMOKE_TEST_EVIDENCE.md`.

**Próximo: 008.5** — tool calling real da Anthropic (Fatia 2): tradução de definições de tools e
`tool_use`, integração com authority-gradient/aprovações/`ExternalToolExecutor` (BE-004/005/006).
Produção continua **bloqueada**; rate cards comerciais e `productionAllowed=true` dependem de
reabrir o gate 008.4A (pricing e governança hoje UNVERIFIED).

## Atualização 008.5

Tool calling da Anthropic (Fatia 2) — **validado OFFLINE apenas**. O provider passa a
**traduzir** definições de tools e `tool_use`, reutilizando integralmente o runtime
provider-neutro 007.5 (validação, binding, autoridade ALLOW/REQUIRE_APPROVAL/DENY, aprovação via
`agent_runtime_checkpoints`, `ActionAuthorization` single-use, idempotência, `ExternalToolExecutor`
como único executor, isolamento 007.4, usage por propósito, limites). O provider **nunca** resolve
credencial de tool, cria aprovação, emite autorização ou executa tool.

- **Tool calling implementation: OFFLINE VERIFIED** (exclusivamente via `FakeAnthropicTransport`).
- **Live Anthropic tool calling: NOT EXECUTED.**
- **Production: BLOCKED** — request com tools exige não produção + `ANTHROPIC_TOOL_CALLING_ENABLED`
  (default false, só honrado fora de produção); produção sempre `MODEL_PROVIDER_DISABLED` antes de
  mapear tools/resolver credencial/tocar transporte.
- Novos mappers puros na borda (codec de nome, guard de descrição, definition/result mappers) +
  request/response mappers estendidos; **sem migração**, sem endpoint novo, OpenAPI diff-free,
  frontend intocado; provider persistido segue `DISABLED`.
- Capabilities do catálogo agora declaram `['STRUCTURED_OUTPUT','TOOL_CALLING']` (IMPLEMENTADA, não
  disponível em produção); custo `null` (`COST_RATE_CARD_NOT_AVAILABLE`); pricing/governança
  seguem **UNVERIFIED**.

Detalhe em `ARDEN_BE_008_ANTHROPIC_TOOL_CALLING_REPORT.md` + evidência em
`ARDEN_BE_008_ANTHROPIC_TOOL_CALLING_TEST_EVIDENCE.md`.

**Próximo: 008.6** — chamada real da Anthropic com tools + streaming + tool calls paralelas +
server-side tools + MCP + subagentes; dependem de reabrir o gate 008.4A (pricing/governança hoje
UNVERIFIED) antes de rate cards comerciais e `productionAllowed=true`.

## Atualização 008.6

<!-- Milestone: ARDEN-BE-008.6 -->

Entregue como **FATIA FOCADA**: página de administração do provider Anthropic (`/anthropic`),
**somente leitura / status-only**, consumindo a API v1 real (`GET /model-providers` via
`useModelProviders`, sem mock). Localiza `anthropic.direct` e renderiza banner permanente de
produção bloqueada, resumo real do provider e estados de verificação em texto + ícone (preço
NÃO VERIFICADO, governança de dados NÃO VERIFICADA, smoke NÃO EXECUTADO, tool calling validado
OFFLINE, disponibilidade apenas não produtiva). Rota guardada por `model_provider.view`; nav no
grupo `control`; namespace i18n `anthropic` em pt-BR e en-US. As ações enlaçam para as telas
provider-neutras já existentes (Integrações → connections; ModelConfigurations) — **reuso, não
reconstrução**.

- **Delivered (OFFLINE, status-only):** página read-only + visibilidade de status; 5 testes
  unit + 1 a11y verdes; suíte de frontend 255 unit + 3 a11y; typecheck/lint limpos; build ok;
  OpenAPI diff-free.
- **DEFERIDO:** wizard dedicado de criação de connection Anthropic; diálogo de rotação; painel
  de smoke conectado a auditoria; wizard de ModelConfiguration com allowlist de modelos da API;
  badges de elegibilidade no editor de AgentVersion; linhas de execução com provider/modelo;
  envelopamento no cliente gerado dos endpoints de catálogo por modelo e validate-configuration;
  matriz completa de testes (~46 unit / ~20 integração / E2E offline / canário de segredo-no-DOM
  / cross-tenant-404).
- **Restrições de backend refletidas na UI:** smoke é CLI-only (sem endpoint HTTP; metadados
  removidos pelo serializer) — sem botão funcional, só status + instruções; sem endpoint de
  elegibilidade/bloqueadores (aflora via `MODEL_PROVIDER_DISABLED` no `activate`); permissões
  reais (`connection.edit`, `connection.test`, `model_configuration.edit`, `model_provider.view`).
- **Live smoke: NOT EXECUTED. Live tool calling: NOT EXECUTED. Production: BLOCKED. Pricing:
  UNVERIFIED. Data governance: UNVERIFIED.**

Detalhe em `docs/implementation/ARDEN_BE_008_ANTHROPIC_FRONTEND_REPORT.md` (+ evidência em
`ARDEN_BE_008_ANTHROPIC_FRONTEND_TEST_EVIDENCE.md`) e docs de frontend
`docs/frontend/ANTHROPIC_*`.

**008.7 — CONCLUÍDO (encerramento do milestone).** Auditoria independente completa
(`ARDEN_BE_008_MILESTONE_AUDIT.md`, `ARDEN_BE_008_SECURITY_AUDIT.md`); guard da fixture
`CONNECTOR_MASTER_KEY` (production recusa iniciar com fixture de teste conhecida —
`env.schema.ts` + `env.schema.spec.ts`); vertical slices offline automático/supervisionado +
matriz de falhas (`ARDEN_BE_008_VERTICAL_SLICE_EVIDENCE.md`); gates integrais verdes
(`ARDEN_BE_008_FINAL_TEST_EVIDENCE.md`: 271 frontend + 512 backend unit + 264 integração + 4
E2E = 1051, 0 falhas; 11 migrations; seed idempotente; OpenAPI sem drift). Portões de produção
DEFERIDOS em `ARDEN_BE_008_DEFERRED_PRODUCTION_GATES.md`. Produção segue **BLOCKED**; pricing e
governança **UNVERIFIED**; live smoke e live tool calling **NOT EXECUTED**.

**Próximo milestone: ARDEN-PRD-001 — Production Readiness** (não ampliar providers).
