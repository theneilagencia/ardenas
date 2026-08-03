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
