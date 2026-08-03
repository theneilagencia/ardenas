# ARDEN-BE-008 — Auditoria de escopo do primeiro provider comercial

Auditoria EXCLUSIVAMENTE documental (partindo do merge commit do PR #12). Define o menor
milestone seguro para integrar o primeiro provider comercial (Anthropic Claude, direto) sem
reescrever o runtime. Nenhum código, Prisma, migração, OpenAPI, package ou frontend alterado.
Fatos externos marcados **REQUER VERIFICAÇÃO EXTERNA**.

## 1. Provider inicial

Anthropic Claude via API direta (Alternativa A). Comparação e justificativa em
`../backend/COMMERCIAL_MODEL_PROVIDER_DECISION.md`. Decisão arquitetural firme; parâmetros
externos (SDK, IDs, preços, regiões, DPA) a confirmar antes da implementação.

## 2. Inventário do runtime atual (estado real, reuso e delta)

| Área | Estado atual | Reuso direto | Alteração necessária | Risco |
| --- | --- | --- | --- | --- |
| ModelProvider interface | `generate(ModelGenerationRequest)→ModelGenerationResult` (provider-neutral) | total | nenhuma | baixo |
| ModelProviderRegistry | `InMemoryModelProviderRegistry.register(key@version)`; desconhecido→erro | total | registrar o novo provider | baixo |
| Internal test provider | determinístico, `productionAllowed=false`, catálogo fechado | referência de padrão | nenhuma (mantido) | baixo |
| ModelConfiguration | provider/version/modelId/parameters + `credentialConnectionId` + status/revision | total | nenhuma no schema; usar `credentialConnectionId` | baixo |
| Credential vault (BE-006.4) | AES-256-GCM, `connection_credential_versions`, resolução server-side | total | nova connector definition do provider | médio |
| Connection model (BE-006) | `organization_connections` + lifecycle + rede | total | connector definition + política de rede do provider | médio |
| Structured output | `AgentOutputValidatorV1` + repair limitado (server autoridade) | total | mapear no adapter (tool/schema) | médio |
| Tool calling | modelo propõe `ModelToolCall`; servidor valida/autoriza/executa (BE-004/005/006) | total | mapear definitions/calls no adapter | médio |
| Context assembly | v2 server-side, allowlist, isolamento, orçamento, injeção | total | nenhuma | baixo |
| Redaction | segredo/sinal redigidos; nada de prompt/output completo | total | garantir no adapter (payload/log) | médio |
| Prompt injection controls | bloqueio crítico antes do provider (007.4) | total | nenhuma | baixo |
| Usage persistence | `agent_model_call_usage`/rollups; hashes/contadores | total | mapear `agentUsage` do provider | médio |
| Cost estimation | `agent-cost-estimator` BigInt ceilDiv; ausente→null+warning | total | rate cards comerciais versionados | médio |
| Rate cards | `model_rate_cards` + catálogo em código (`MODEL_RATE_CARDS`) | total | catálogo comercial (preços a verificar) | médio |
| Evaluation | `AgentEvaluationEngine` determinístico; llmJudge advisory | total | nenhuma | baixo |
| Evidence | `EvidenceRecord` sanitizado (hashes) | total | nenhuma | baixo |
| Audit | append-only, sem segredo | total | nenhuma | baixo |
| Worker | fila/lease/execução do BE-005 reutilizados por `agent.execute` | total | nenhuma (sem fila nova) | baixo |
| Retry/UNKNOWN | incerto permanece UNKNOWN; replay idempotente | total | matriz de erros do provider | médio |
| Frontend configuration | catálogo de provider, connection, model config, custo (007.7) | parcial | catálogo comercial, one-time API key, teste de conexão | médio |

Nenhuma linha exige "reescrever" — todas reutilizam a infraestrutura BE-004/005/006/007. O
delta é um **adapter** + **connector definition** + **catálogo/rate cards** + **ajustes mínimos
de frontend**.

## 3. Vertical slice recomendado

Um único slice (ver `ARDEN_BE_008_IMPLEMENTATION_PLAN.md` §fatias): criar connection do provider
→ credencial no vault → testar → ativar → model configuration → publicar agent version →
executar operação → contexto redigido ao provider → structured output → validação server-side →
usage + custo persistidos → resultado consultável. O primeiro slice pode funcionar **sem tool
calling** para reduzir risco; tool calling entra num segundo slice.

## 4. Escopo negativo (fora do primeiro milestone)

Multi-provider fallback; routing dinâmico; marketplace de providers; streaming; vision;
arquivos; batch; prompt caching avançado; computer use; fine-tuning; embeddings; RAG; avaliação
por LLM; model gateway; billing/compra de créditos; bring-your-own-model endpoint.

## 5. Pontos que exigem verificação externa

SDK TS oficial (nome/versão); IDs de modelo + limites de tokens; preços; regiões/data
residency; retenção/treinamento; DPA/sub-processadores; enterprise controls; quotas/rate limits.
Detalhados em `../backend/COMMERCIAL_PROVIDER_DATA_GOVERNANCE.md` e `..._MODEL_CATALOG.md`.

## 6. Riscos bloqueantes

Denial of wallet / abuso de custo (mitigar com tetos de custo/rate na governança 007.6 +
platform vs tenant credential); vazamento de API key (vault + resolução server-side, nunca no
frontend/prompt/log); model substitution / modelId arbitrário (allowlist fechada); logging de
prompt/resposta pelo provider (verificação externa de retenção/treinamento + DPA). Threat model
completo em `../backend/COMMERCIAL_PROVIDER_SECURITY_THREAT_MODEL.md`.
