# ARDEN-BE-007 — Plano de implementação (runtime de agentes)

> **Documento de PLANEJAMENTO. Nenhum código, migration, contrato ou dependência é
> alterado nesta etapa.** Deriva as fases do runtime de agentes a partir da
> [`ARDEN_BE_007_SCOPE_AUDIT.md`](./ARDEN_BE_007_SCOPE_AUDIT.md) e das decisões de domínio
> em [`../backend/AGENT_DOMAIN_MODEL_DECISION.md`](../backend/AGENT_DOMAIN_MODEL_DECISION.md).
> A implementação começa em 007.1 (a ser autorizada separadamente) — **não** nesta
> auditoria.

## 1. Princípios do faseamento

1. **Vertical slice antes de amplitude.** Cada fase entrega end-to-end verificável, nunca
   um andar horizontal inerte. A fatia mínima está em `SCOPE_AUDIT §7`.
2. **Reuso máximo do BE-005/006.** Nenhuma fila, endpoint de execução direta, auditoria ou
   evidência nova. `AgentStepExecutor` entra no `StepExecutorRegistry` como o
   `ExternalToolStepExecutor` entrou em 006.6.
3. **Segurança desde a primeira fatia.** Structured output, limites de runtime, segredo fora
   do prompt e tenant da linha valem já em 007.3, não são "hardening posterior".
4. **Um provedor real, abstração desde o início.** `ModelProvider` é interface desde 007.1;
   um provedor concreto (recomendado Anthropic/Claude) em 007.3.
5. **Gates por fase** iguais aos de BE-006: typecheck + lint (api e monorepo), contracts,
   unit, integração, `contracts:openapi` sem diff.

## 2. Fases

Fases consolidáveis foram fundidas para reduzir andares horizontais. Ordem obrigatória; cada
fase depende da anterior.

### 007.1 — Arquitetura, contratos e action key
- Contratos `src/contracts/agents/*` (`AgentDefinition`, `AgentVersion`, `ModelConfiguration`,
  policies, `AgentModelCall`, erros `AGENT_*`).
- `agent.execute` no `executorActionKey`; `operationStep.agent = { agentKey, actionKey }`
  espelhando `operationStep.tool`.
- Novos códigos de erro (`AGENT_OUTPUT_INVALID`, `AGENT_LIMIT_EXCEEDED`,
  `AGENT_TOOL_DENIED`, `AGENT_VERSION_NOT_PUBLISHED`, `MODEL_PROVIDER_UNAVAILABLE`) no
  catálogo + mapa HTTP.
- OpenAPI regenerado (CI sem diff). **Sem persistência ainda.**
- Gate: typecheck, lint, contracts, `contracts:openapi` limpo.

### 007.2 — Persistência (Prisma) + CRUD administrativo
- Models `AgentDefinition`, `AgentVersion`, `ModelConfiguration`, `AgentModelCall`
  (tenant-scoped, `status`+state machine, `revision`, timestamps) espelhando
  `ConnectorDefinition`/`OrganizationConnection`/`OperationVersion`.
- Migration **nova** (nunca editar migration aplicada).
- Endpoints administrativos tenant-scoped/permissionados (CRUD + publicação de versão), como
  os de conectores. **Sem endpoint de execução direta.**
- Gate: + unit dos services, integração de CRUD/publicação.

### 007.3 — Runtime do provedor + saída estruturada (fatia vertical mínima)
- `ModelProvider`/`ModelProviderRegistry` + **um** provedor real; dependência de SDK
  adicionada aqui (primeira e única introdução de SDK de LLM).
- Credencial do provedor via `SecretVault`/`CredentialResolver` (BE-006.4) — server-side,
  nunca no prompt/job/log.
- `AgentStepExecutor` no `StepExecutorRegistry`; `AgentBindingResolver` tenant-scoped.
- `ModelProvider.generate` com **structured output** validado por `outputSchema`
  (reuso de `json-schema-validator.ts`); retry de correção limitado; `AGENT_OUTPUT_INVALID`
  nunca vira sucesso silencioso.
- `AgentExecutionPolicy` aplicada (turnos/tokens/custo/timeout = `min` do step).
- **Entrega o vertical slice do `SCOPE_AUDIT §7`** (classificação sem tool-use).
- Gate: + integração end-to-end (operação → execução → agente → output válido/ inválido).

### 007.4 — Montagem de contexto + guardrails de entrada
- `ContextAssembler`: fontes filtradas por `contextPolicy` (allowlist de
  `contextSourceIds`), budget de tokens, redação; separação de canais (instrução vs. dado
  não confiável) conforme [`../backend/AGENT_PROMPT_INJECTION_THREAT_MODEL.md`](../backend/AGENT_PROMPT_INJECTION_THREAT_MODEL.md).
- `systemInstructions`/`objective` sempre da versão publicada, nunca do request.
- Gate: + testes de injeção (dado não confiável não altera instrução/autoridade).

### 007.5 — Tool calling + autoridade
- `AgentToolCallGate`: modelo PROPÕE, servidor valida (`ToolBindingResolver`, alias na
  allowlist da versão) e executa (`ExternalToolExecutor` de 006.6); autoridade por tool call
  decidida pela política da operação (BE-004).
- Tool call que exige aprovação → execução `SUSPENDED` reusando `ActionAuthorization`/approval
  (BE-004/005). Modelo nunca recebe segredo (ver [`../backend/AGENT_TOOL_CALLING_SECURITY.md`](../backend/AGENT_TOOL_CALLING_SECURITY.md)).
- Gate: + testes de tool-gate (alias fora da allowlist negado; segredo ausente do payload do
  modelo; suspensão/retomada por aprovação).

### 007.6 — Avaliação, evidência e custo
- `AgentEvaluator`: verificações determinísticas primeiro; judge-LLM **opcional**
  ([`../backend/AGENT_EVALUATION_MODEL.md`](../backend/AGENT_EVALUATION_MODEL.md)).
- `AgentModelCall` (tokens/custo por chamada) + evidência sanitizada pelo `ExecutionRecorder`;
  eventos `agent.*` no trail existente; classificação de dados
  ([`../backend/AGENT_COST_AND_USAGE.md`](../backend/AGENT_COST_AND_USAGE.md)).
- Gate: + testes de avaliação/telemetria; canário de segredo na evidência/custo.

### 007.7 — Frontend API-backed
- Telas de administração de agente (definições/versões/model configs) consumindo API real
  (padrão BE-006.8), **sem** store mock/IndexedDB como fonte funcional.
- Recontextualização das cascas existentes (`/evaluator`, `AssistantPanel`) apenas como UI;
  fonte de dados = API.
- Gate: + typecheck/lint/testes de frontend, a11y.

### 007.8 — Hardening final + PR
- Auditoria de segurança (grep de segredo, SSRF, tenant, prompt injection), docs finais,
  abertura do PR de implementação (base a definir na autorização de 007). **Sem merge sem
  gates verdes.**

## 3. Consolidações possíveis

Se a autorização de 007 pedir menos fases: 007.1+007.2 podem virar uma fase (contratos +
persistência) e 007.4+007.5 podem fundir contexto+tool-gate. **007.3 (slice vertical)
permanece indivisível** — é a prova de vida do runtime.

## 4. Fora de escopo do BE-007 (explicitamente adiado)

`agent.evaluate`, `model.generate_structured`, `model.classify/extract/summarize` como action
keys próprias; múltiplos provedores simultâneos; retrieval/RAG real; chat interativo;
qualquer endpoint público de execução direta de modelo/agente.

## 5. Restrições invioláveis (herdadas)

Sem nova fila; sem endpoint de execução direta; executor por action key registrada (DI);
nenhum segredo no prompt/job/log/evidência; tenant sempre da linha; abstração de provedor
obrigatória; structured output obrigatória; sem "sucesso silencioso". Migrations novas nunca
editam migrations aplicadas.

## 6. Próximo passo

Aguardar autorização explícita para iniciar **007.1**. Esta auditoria **não** inicia código:
não há PR de implementação, migration, alteração de OpenAPI nem dependência adicionada nesta
etapa.
