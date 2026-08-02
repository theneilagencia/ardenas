# ARDEN-BE-007.4 — Context assembly v2, guardrails e isolamento de fontes

Evolução do context assembly mínimo (v1, 007.3) para um pipeline **determinístico,
tenant-scoped e defensivo** de montagem de contexto. Sem provider comercial, SDK,
internet, tool calling funcional, RAG/embeddings, memória, frontend, chat ou endpoint
direto. Integra-se ao runtime pela etapa `agent.execute` do motor do BE-005.

## Fluxo canônico

```
ExecutionRun persistido
  → AgentRuntimeResolver (tenant-scoped, §7)
  → AgentContextSourceResolver (DB, org+run-scoped)
  → validação de tenant (organizationId em toda cláusula)
  → autorização de fonte (allowlist da AgentContextPolicy)
  → normalização de conteúdo (serializável, sem tipos perigosos)
  → SensitiveDataRedactor (redação recursiva)
  → classificação de confiança (SYSTEM/TENANT/UNTRUSTED)
  → PromptInjectionGuard (ALLOW / ALLOW_WITH_ISOLATION / BLOCK)
  → alocação de orçamento (tetos por categoria + truncamento seguro)
  → montagem do prompt (instrução vs dado; isolamento por delimitadores)
  → requisição ao modelo (provider determinístico)
  → evidência + auditoria (apenas hashes/metadados — nunca conteúdo bruto)
```

## Componentes (`apps/api/src/agents/runtime/context/`)

| Arquivo | Papel |
| --- | --- |
| `agent-context.types.ts` | Tipos internos + token DI `AGENT_CONTEXT_SOURCE_RESOLVER` + mapeamento de origem de sinal. |
| `agent-context-source-resolver.ts` | **Único** acesso a DB. Resolve fontes permitidas, sempre `{organizationId, executionRunId}`; documentos vinculados → `SOURCE_NOT_SUPPORTED`. |
| `agent-context-normalizer.ts` | PURO. Normaliza para JSON serializável (rejeita Buffer/TypedArray/stream/função/symbol/BigInt/circular/instância de classe) + redige + hashes. |
| `agent-context-trust-classifier.ts` | PURO. Nível de confiança por categoria e por `actionKey` do produtor. |
| `prompt-injection-guard.ts` | PURO. Correspondência explícita de marcadores; decisão ALLOW/ALLOW_WITH_ISOLATION/BLOCK. |
| `agent-context-budget-allocator.ts` | PURO. Dedup + tetos percentuais por categoria + teto global + truncamento UTF-8/JSON seguro. |
| `agent-context-assembler-v2.ts` | Orquestrador. Devolve `AgentContextAssemblyResult` (mensagens + metadados sanitizados). |

## AGENT_CONTEXT_ASSEMBLY_V2

O assembler v2 orquestra o pipeline e devolve um `outcome` discriminado:
`ASSEMBLED | BLOCKED | BUDGET_EXCEEDED | SOURCE_INVALID`. Em `ASSEMBLED`, monta um bloco
`TEXT` de objetivo seguido de blocos por fonte; fontes confiáveis entram como bloco de
dado; fontes não confiáveis entram **isoladas** entre delimitadores. As instruções de
sistema seguem no campo `systemInstructions` (canal confiável, separado do dado). Os
blocos são divididos em mensagens `USER` respeitando o teto de blocos do contrato.

## AGENT_CONTEXT_SOURCE_RESOLUTION

Fontes suportadas e sua resolução tenant-scoped:

- **EXECUTION_INPUT** — `$source` da etapa (canal de dado). Ligado por `includeExecutionInput`.
- **OPERATION_METADATA** — campos seguros (nome da operação, número da versão, nome/chave
  da etapa). Nunca segredo. Ligado por `includeOperationMetadata`.
- **PREVIOUS_STEP_OUTPUT** — apenas `allowedStepKeys`; etapas SUCCEEDED do **mesmo run/tenant**
  com `sequence` anterior. Referência ausente → excluída `SOURCE_NOT_FOUND`.
- **TOOL_RESULT** — apenas `allowedToolAliases`; saída de etapa externa (`$tool.alias`) SUCCEEDED
  do mesmo run/tenant e anterior. Ausente → `SOURCE_NOT_FOUND`.
- **LINKED_DOCUMENT** — sem infraestrutura de documentos nesta fase → sempre excluída
  `SOURCE_NOT_SUPPORTED` (nunca lê arquivo/rede).

IDs conhecidos não concedem acesso: toda consulta filtra por `organizationId` **e**
`executionRunId`. A etapa do agente é validada (`SOURCE_NOT_ALLOWED` se não pertencer ao
tenant).

## AGENT_CONTEXT_TRUST_MODEL

| Categoria | Confiança | Isolamento |
| --- | --- | --- |
| OPERATION_METADATA | SYSTEM_TRUSTED | não |
| EXECUTION_INPUT | TENANT_TRUSTED | não |
| PREVIOUS_STEP_OUTPUT (produtor interno determinístico) | TENANT_TRUSTED | não |
| PREVIOUS_STEP_OUTPUT (`agent.execute` / `external.*`) | UNTRUSTED_EXTERNAL | sim |
| TOOL_RESULT | UNTRUSTED_EXTERNAL | sim |
| LINKED_DOCUMENT | UNTRUSTED_EXTERNAL | sim (excluída nesta fase) |

Produtor desconhecido → tratado como não confiável (fail-safe). Instruções de sistema e
objetivo são o **único** canal de instrução; todo o resto é dado.

## PROMPT_INJECTION_GUARD

Determinístico e PURO — sem LLM, heurística estatística ou rede. Correspondência explícita
de marcadores/frases sobre a serialização **já redigida** da fonte. Decisão:

- Sinal **CRITICAL** (`SECRET_EXFILTRATION_ATTEMPT`, inclui o canário de teste e frases de
  exfiltração) → **BLOCK** de todo o contexto, mesmo em fonte confiável.
- Fonte **UNTRUSTED_EXTERNAL** → **ALLOW_WITH_ISOLATION** (o dado é neutralizado por
  delimitadores). Instrução de injeção detectada vira sinal não bloqueante
  `UNTRUSTED_CONTENT_INSTRUCTION`.
- Fonte confiável → **ALLOW**; frases suspeitas são registradas como sinais não bloqueantes.

A defesa primária contra conteúdo externo é o **isolamento**, não o bloqueio: execuções
legítimas com dados externos "ruidosos" não são derrubadas, enquanto exfiltração
inequívoca é bloqueada. `AGENT_PROMPT_INJECTION_DETECTED` é emitido apenas em BLOCK.

## AGENT_TOOL_RESULT_ISOLATION

Resultados de tools e saídas de agentes anteriores são **sempre** UNTRUSTED_EXTERNAL e
entram entre `<untrusted_source kind=… ref=…>` … `</untrusted_source>`, precedidos de uma
instrução explícita de que o conteúdo é **dado, não instrução**. Cabeçalhos e campos
sensíveis (ex.: `authorization`) são redigidos antes da montagem, então tokens de tool não
entram no prompt nem na evidência. Nenhuma instrução vinda de tool é executada.

## AGENT_CONTEXT_BUDGETING

Reserva `systemInstructions + objetivo + margem (4096 bytes)`; o restante é o orçamento
disponível. Tetos por categoria (frações do disponível): EXECUTION_INPUT 40%,
PREVIOUS_STEP_OUTPUT 30%, TOOL_RESULT 20%, LINKED_DOCUMENT 20%, OPERATION_METADATA 5%. Um
teto **global corrente** garante `Σ incluídos ≤ disponível`. Fontes idênticas (mesmo
`redactedHash`) são deduplicadas (`DUPLICATE_SOURCE`). Fontes que excedem o teto são
truncadas em fronteira **UTF-8** e embrulhadas num envelope JSON válido
(`{ __ardenTruncated, omittedBytes, preview }`), garantindo serialização final dentro do
teto. Se nem o reservado couber → `AGENT_CONTEXT_BUDGET_EXCEEDED`.

## AGENT_CONTEXT_REDACTION

Redação recursiva pelo `SensitiveDataRedactor` central (case-insensitive, resistente a
arrays/ciclos), aplicada a **cada** fonte após a normalização e antes da classificação. Os
hashes `originalHash` (pré-redação) e `redactedHash` (pós-redação) são SHA-256 estáveis —
nunca o conteúdo em claro. A evidência carrega apenas hashes/metadados.

## AGENT_CONTEXT_EVIDENCE

A evidência de execução ganha: `contextHash` (hash estável do descritor de contexto),
`contextTruncated`, `includedSources[]` (kind/ref/label/trust/isolated/truncated/bytes/
hashes) e `excludedSources[]` (kind/ref/reason). Eventos de trilha (append-only):
`agent.context_source_resolved`, `agent.context_source_excluded`,
`agent.context_source_truncated`, `agent.context_security_signal_detected`,
`agent.context_blocked`, `agent.context_budget_exceeded`, `agent.context_assembled`.
Nenhum conteúdo bruto, prompt ou segredo é persistido — só hashes e metadados sanitizados.

## AGENT_CONTEXT_ERROR_MODEL

| Código | HTTP | Quando |
| --- | --- | --- |
| `AGENT_CONTEXT_SOURCE_NOT_ALLOWED` | 403 | Violação dura de tenant/autorização de fonte. |
| `AGENT_CONTEXT_SOURCE_NOT_FOUND` | 404 | Referência allowlistada sem correspondência (não fatal: fonte excluída). |
| `AGENT_CONTEXT_SOURCE_INVALID` | 422 | Fonte obrigatória (input) não serializável/normalizável. |
| `AGENT_CONTEXT_BUDGET_EXCEEDED` | 413 | Reservado excede o orçamento; nada cabe. |

Reutilizados de fases anteriores: `AGENT_CONTEXT_TOO_LARGE` (413, teto de bytes pós-montagem),
`AGENT_TOKEN_LIMIT_EXCEEDED` (409), `AGENT_PROMPT_INJECTION_DETECTED` (403).

## Integração e limites

- `agent-runtime.ts`: usa o assembler v2 (async, DB); trata os desfechos terminais; emite
  a trilha de contexto; enriquece a evidência final. O provider só é chamado após ASSEMBLED.
- `agents.module.ts`: providers do pipeline + `AGENT_CONTEXT_SOURCE_RESOLVER`. Sem ciclo.
- Sem nova migration, tabela, endpoint HTTP ou alteração de OpenAPI além dos 4 códigos de
  erro. Assembler v1 (007.3) foi **substituído** pelo v2.

## Fora de escopo (adiado)

Provider comercial, tool calling funcional, autorização de tool call, RAG/embeddings/vector
DB, crawling/browser, memória, frontend, chat, billing, avaliação por LLM, detecção de
injeção por LLM, infraestrutura de documentos vinculados (007.5+).
