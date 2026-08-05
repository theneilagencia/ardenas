# ARDEN-BE-007 — Auditoria de escopo (runtime de agentes / IA)

> **Documento de AUDITORIA. Nenhum código, migration, contrato ou dependência é alterado
> nesta etapa.** Mapeia o estado real do repositório na base do merge commit
> `a13405c` (PR #10, fechamento do ARDEN-BE-006) e define o que existe, o que é
> reutilizável e o que é greenfield antes de qualquer implementação do runtime de agentes.
> Decisões de domínio em [`AGENT_DOMAIN_MODEL_DECISION.md`](../backend/AGENT_DOMAIN_MODEL_DECISION.md);
> arquitetura em [`AGENT_EXECUTION_ARCHITECTURE.md`](../backend/AGENT_EXECUTION_ARCHITECTURE.md).

## 1. Método

Cada superfície foi confrontada contra a arquitetura real:

- **Backend**: `apps/api/prisma/schema.prisma`, `apps/api/src/executions/*`,
  `apps/api/src/connectors/*`, contratos em `src/contracts/*`, dependências em
  `package.json` (raiz e workspaces).
- **Frontend**: `src/features/*`, `src/components/layout/*`, `src/stores/*`.
- **Dependências de IA/LLM**: busca por `@anthropic-ai/*`, `openai`, `bedrock`,
  `vertexai`, `ai` (Vercel AI SDK) em todos os `package.json` e lockfile.

**Achado transversal:** não existe nenhuma dependência de SDK de LLM no monorepo, nem
módulo backend de agente/modelo/prompt/custo/token. O domínio de runtime de agentes é
**greenfield**. As superfícies "de IA" hoje visíveis no frontend são **determinísticas /
mock** e **não** constituem um runtime de agente.

## 2. Classificação — legenda

- **AUSENTE** — não existe; greenfield.
- **REUTILIZÁVEL** — existe e serve de base direta (padrão, motor, contrato, componente).
- **MOCK/DETERMINÍSTICO** — existe como simulação de produto; NÃO é runtime de agente;
  reutilizável apenas como casca de UI ou primitiva conceitual.
- **PARCIAL** — primitiva existe mas não cobre o domínio de agente.

## 3. Inventário de escopo (16 linhas obrigatórias)

| # | Capacidade | Estado atual | Evidência / âncora | Reuso para BE-007 |
| --- | --- | --- | --- | --- |
| 1 | **Definição de agente** (`AgentDefinition`) | **AUSENTE** (greenfield) | Nenhum model no `schema.prisma`; nenhum módulo `agents/`. | Padrão a espelhar: `OrganizationConnection`/`ConnectorDefinition` (`schema.prisma` L985–1071) — tenant-scoped, `status` com state machine, `revision`, auditado. |
| 2 | **Versões de agente** (`AgentVersion`) | **AUSENTE** | Nenhum model. | Espelhar `OperationVersion` (`schema.prisma` L296–323): DRAFT→PUBLISHED→RETIRED, imutável pós-publicação, publicação transacional. |
| 3 | **Provedores de modelo** (`ModelProvider`) | **AUSENTE**; nenhum SDK de LLM instalado | Sem `@anthropic-ai/*`/`openai`/`bedrock`/`vertexai`/`ai` no repo. | Padrão de abstração em [`MODEL_PROVIDER_ABSTRACTION.md`](../backend/MODEL_PROVIDER_ABSTRACTION.md); credenciais via `SecretVault` (BE-006.4). |
| 4 | **Configurações de modelo** (`ModelConfiguration`) | **AUSENTE** | — | Segredo via cofre existente; nunca em job/log (padrão BE-006.6). |
| 5 | **Templates de prompt / instruções** | **AUSENTE** (backend). Frontend tem textos determinísticos, não prompts de modelo | `AssistantPanel.tsx` (texto fixo "Assistente contextual determinístico… Sem API externa"). | `systemInstructions`/`objective` **versionados** na `AgentVersion`; nunca vindos do request (ver [`AGENT_CONTEXT_AND_PROMPT_MODEL.md`](../backend/AGENT_CONTEXT_AND_PROMPT_MODEL.md)). |
| 6 | **Montagem de contexto** (context assembly) | **AUSENTE** | Sem RAG/retrieval; `contextSourceIds` na `OperationDefinition` é lista de IDs sem runtime. | `operationDefinition.contextSourceIds` (`operation-versions.schemas.ts:69`) é a primitiva declarativa; runtime é greenfield (`ContextAssembler`). |
| 7 | **Tool calling** | **REUTILIZÁVEL** (base pronta) | `ExternalToolExecutor` + `StepExecutorRegistry` (`step-executor-registry.ts:24-36`) + `operationStep.tool={alias,actionKey}` (`operation-versions.schemas.ts:28-46`). | Base direta: o `AgentToolCallGate` reusa `ToolBindingResolver` + `ExternalToolExecutor` de 006.6. Modelo propõe, servidor valida/executa (ver [`AGENT_TOOL_CALLING_SECURITY.md`](../backend/AGENT_TOOL_CALLING_SECURITY.md)). |
| 8 | **Saída estruturada** (structured output) | **PARCIAL** | Validador de JSON schema existe: `connectors/tools/json-schema-validator.ts` (I/O de ferramentas). | Reusar o validador para `outputSchema` do agente; contrato de retry de correção em [`AGENT_STRUCTURED_OUTPUT.md`](../backend/AGENT_STRUCTURED_OUTPUT.md). |
| 9 | **Avaliação** (evaluation/guardrails de saída) | **AUSENTE** | Nenhum harness de avaliação. | Verificações determinísticas primeiro; judge-LLM opcional ([`AGENT_EVALUATION_MODEL.md`](../backend/AGENT_EVALUATION_MODEL.md)). |
| 10 | **Guardrails / limites de runtime** | **PARCIAL** | Motor já tem timeout/retry/idempotência por step (BE-005) e política de rede/SSRF (BE-006.5). | `AgentExecutionPolicy` (turnos/tool calls/tokens/custo) COMPLEMENTA o timeout do step; reusa `SecureHttpClient`. |
| 11 | **Prompt injection (defesa)** | **AUSENTE** (nenhum vetor de LLM ainda) | Sem modelo generativo, não há superfície de injeção hoje. | Threat model em [`AGENT_PROMPT_INJECTION_THREAT_MODEL.md`](../backend/AGENT_PROMPT_INJECTION_THREAT_MODEL.md): separação de canais, tool-gate no servidor, sem segredo no prompt. |
| 12 | **Rastreio de custo / uso** (tokens) | **AUSENTE** (custo real). `workUnitCost` é a primitiva mais próxima | `operationStep.workUnitCost` (`operation-versions.schemas.ts:42`) e `/budget` (store mock). | `AgentModelCall` (usage record) por chamada de modelo ([`AGENT_COST_AND_USAGE.md`](../backend/AGENT_COST_AND_USAGE.md)); `workUnitCost` continua sendo custo de negócio, não de tokens. |
| 13 | **Aprovações humanas** (human-in-the-loop) | **REUTILIZÁVEL** | `ApprovalFlow`/`ApprovalRequest` (`schema.prisma` L493–575), `ActionAuthorization` (L616–647), suspensão de execução (BE-005). | Tool call que a autoridade (BE-004) exige aprovação → `SUSPENDED` reusando `ActionAuthorization`/approval. Nada novo. |
| 14 | **Auditoria** | **REUTILIZÁVEL** | `audit_events` (BE-002/004), `AuditRecorder`, `ExecutionEvent` (`schema.prisma` L827–849). | Eventos `agent.*` entram no trail existente; **nenhuma auditoria nova**. |
| 15 | **Evidência** | **REUTILIZÁVEL** | `EvidenceRecord` (`schema.prisma` L850–873), `ExecutionRecorder` (append-only, sanitizado). | Evidência de agente sanitizada pelo `ExecutionRecorder`; prompts completos NÃO registrados indiscriminadamente. |
| 16 | **Frontend de agente** | **MOCK/DETERMINÍSTICO** (incompatível como runtime; reutilizável como casca de UI) | Ver §4. | Cascas de UI (`/assessment`, `/evaluator`, `AssistantPanel`) podem ser recontextualizadas; a fonte de dados deve virar API real (padrão BE-006.8), nunca store mock. |

## 4. Superfícies "de IA" do frontend — auditoria detalhada

Nenhuma destas é um runtime de agente. Todas são store-backed / determinísticas.

| Superfície | Rota / arquivo | Natureza real | Veredito |
| --- | --- | --- | --- |
| Assessment | `/assessment` (`AssessmentPage`) | Funil de qualificação store-backed; sem modelo. | MOCK — casca de UI reutilizável. |
| Evaluator | `/evaluator` (`EvaluatorPage`) | 12 passos hardcoded; recomendação fixa ("Forte candidata"). | DETERMINÍSTICO — **não** é avaliação de agente; casca reutilizável. |
| Assistant | `AssistantPanel.tsx` | Texto fixo; auto-descrito "determinístico… Sem API externa". | MOCK — **não** é chat/LLM. |
| Budget | `/budget` (store mock) | `workUnitCost` por step é a primitiva de custo mais próxima. | MOCK — primitiva de custo de negócio, não de tokens. |
| Results | `/results` (store mock) | `PERIODS` hardcoded. | MOCK. |
| Governance | `GovernancePage` (store mock) | Motor `Policy` real (BE-004) NÃO está ligado à página. | MOCK na UI; motor real existe no backend. |
| Security | `SecurityPage` | Lê negações reais via `useAuditEvents({result:'denied'})`. | PARCIAL — já consome API real; base para telemetria de agente. |

## 5. Pontos de extensão confirmados (reuso direto do BE-005/006)

1. **`StepExecutorRegistry.resolve(actionKey)`** (`apps/api/src/executions/step-executor-registry.ts:24-36`)
   — o `AgentStepExecutor` pluga aqui via DI, exatamente como o `ExternalToolStepExecutor`
   de 006.6. Roteamento por **action key registrada**, nunca por classe vinda do banco.
2. **`executorActionKey`** (`src/contracts/executions/executions.schemas.ts:52-81`) — hoje
   internos + externos (`external.*`, `connector.test.*`) com `isExternalExecutorActionKey`.
   **Falta** `agent.execute` (a adicionar em 007.1, não nesta etapa).
3. **`operationStep.tool`** (`src/contracts/operation-versions/operation-versions.schemas.ts:28-46`)
   — o padrão `{ alias, actionKey }` a espelhar em `operationStep.agent`.
4. **`ToolBindingResolver` / `ExternalToolExecutor`** (`apps/api/src/connectors/tools/*`) —
   reusados pelo `AgentToolCallGate` para autorizar/executar tool calls do modelo.
5. **`SecretVault` / `CredentialResolver`** (BE-006.4) — credencial do provedor de modelo
   resolvida server-side, nunca no prompt/job/log.
6. **`json-schema-validator.ts`** — reusado para `inputSchema`/`outputSchema` do agente.
7. **`ExecutionRecorder` + `AuditRecorder`** — evidência/auditoria `agent.*` sem infra nova.

## 6. Lacunas (greenfield real) — a implementar

Persistência (`AgentDefinition`, `AgentVersion`, `ModelConfiguration`, `AgentModelCall`);
`ModelProvider`/`ModelProviderRegistry` + **um** provedor real (recomendado Anthropic/Claude);
`AgentStepExecutor` + `agent.execute`; `ContextAssembler`; `AgentToolCallGate`; correção de
saída estruturada; `AgentEvaluator`; contabilização de tokens/custo; contratos
(`src/contracts/agents/*`) e OpenAPI regenerado; telas de administração de agente API-backed.

## 7. Vertical slice recomendado (§27 — mínimo end-to-end)

**Objetivo:** provar o caminho completo com o menor domínio possível, reusando o máximo do
BE-005/006.

**Slice = "uma etapa de operação chama um agente que classifica um input contra um
`outputSchema`, sem tool calls, com custo/tokens registrados e evidência sanitizada".**

Componentes mínimos:

1. `AgentDefinition` + `AgentVersion` (uma versão publicada) — persistência mínima.
2. `ModelConfiguration` apontando para **um** `ModelProvider` real (credencial no cofre).
3. `agent.execute` no `executorActionKey`; `AgentStepExecutor` no `StepExecutorRegistry`.
4. `operationStep.agent = { agentKey, actionKey: 'agent.execute' }`.
5. `ContextAssembler` mínimo (só o input da etapa + `objective` versionado; sem retrieval).
6. `ModelProvider.generate` com **structured output** validado por `outputSchema`
   (sem tool-use nesta primeira fatia).
7. `AgentExecutionPolicy` aplicada (turnos=1, tokens/custo limitados, timeout do step).
8. `AgentModelCall` (usage) + evidência sanitizada + eventos `agent.*`.
9. Resultado `SUCCEEDED` (output válido) / `FAILED` (`AGENT_OUTPUT_INVALID`, nunca sucesso
   silencioso).

**Fora do slice (fases seguintes):** tool calling do modelo, aprovação humana de tool call,
context retrieval real, judge-LLM, múltiplos provedores, `agent.evaluate`/`model.*`.

Este slice exercita: motor BE-005 (fila/worker/registry), autoridade BE-004, cofre BE-006.4,
validador de schema, auditoria/evidência — sem nenhuma fila ou endpoint novo.

## 8. Restrições herdadas (invioláveis no BE-007)

Reafirmadas de BE-005/006 e aplicáveis ao runtime de agente:

- Sem nova fila; reusar o motor BE-005.
- Sem endpoint público de execução direta (`/agents/{id}/run`, `/chat`, `/models/generate`).
- Executor selecionado por **action key registrada** (DI), nunca por classe vinda do banco.
- Nenhum segredo entra no prompt/job/log/evidência/idempotência.
- Tenant sempre da LINHA da execução / do binding, nunca do request.
- Modelos são infraestrutura substituível (abstração de provedor obrigatória).
- Saída estruturada obrigatória; sem "sucesso silencioso" com output inválido.
