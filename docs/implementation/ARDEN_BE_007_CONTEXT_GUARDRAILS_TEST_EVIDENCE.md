# ARDEN-BE-007.4 — Evidência de testes (context assembly v2 e guardrails)

## Ambiente
PostgreSQL 16 real (cluster local) + fila durável + worker real. `AUTH_PROVIDER=fake`.
Sem internet, sem SDK comercial, sem tool calling funcional. Fontes de pré-passo (tool
result / previous step output) são **semeadas no banco** — nenhuma ferramenta externa é
executada de fato.

## Testes unitários (`npm run test:api`) — 378 passed, exit 0
Novos (`agents/runtime/context/context-units.spec.ts`, 38 casos) cobrindo os componentes
PUROS do pipeline:
- **normalizeValue / AgentContextNormalizer**: objeto serializável; vazio; rejeição de
  BigInt, função, symbol, Buffer, TypedArray, número não finito, referência circular e
  instância de classe; Date → ISO; descarte de `undefined`; redação + hashes distintos;
  `SOURCE_INVALID` / `SOURCE_EMPTY`.
- **classifyTrust**: SYSTEM/TENANT/UNTRUSTED por categoria e por `actionKey` do produtor;
  produtor desconhecido → não confiável.
- **PromptInjectionGuard**: marcador de exfiltração → BLOCK (CRITICAL) mesmo em fonte
  confiável; override em fonte não confiável → ALLOW_WITH_ISOLATION + sinal não bloqueante
  + `UNTRUSTED_CONTENT_INSTRUCTION`; override em fonte confiável → ALLOW; conteúdo não
  confiável limpo → ALLOW_WITH_ISOLATION sem sinal; detecção de disclosure/tenant boundary.
- **truncamento seguro**: `truncateUtf8` não parte caractere multibyte; `truncateValueToBytes`
  embrulha em envelope JSON válido dentro do teto; valor pequeno intacto.
- **AgentContextBudgetAllocator**: `available<=0` → BUDGET_EXCEEDED; dedup por `redactedHash`;
  truncamento por teto de categoria; ordem de prioridade; `Σ incluídos ≤ disponível`.

A suíte do runtime (`agent-runtime.spec.ts`, 16) e as unidades (`runtime-units.spec.ts`, 10)
foram migradas para o **assembler v2** com um resolver de fontes FAKE (DB-free) e continuam
verdes. Guarda de escopo (`agents-no-runtime.spec.ts`) permanece verde: nenhum arquivo do
módulo (incluindo `context/`) importa SDK comercial nem faz rede real.

## Testes de integração — `agent-context.integration.spec.ts` (5), PostgreSQL + worker real

| Cobertura | Resultado |
| --- | --- |
| **§42/§47** injeção determinística: probe de exfiltração no input → step FAILED `AGENT_PROMPT_INJECTION_DETECTED` + evento `agent.context_blocked` | ✓ |
| **§43/§46** isolamento de tool result: `authorization` + injeção → SUCCEEDED; canário (token e apiKey) redigido em eventos/evidência/audit; fonte `TOOL_RESULT` `isolated=true` `UNTRUSTED_EXTERNAL`; sinal `UNTRUSTED_CONTENT_INSTRUCTION` não bloqueante | ✓ |
| **§47** inclusão legítima: previous step output determinístico → SUCCEEDED; incluído como `TENANT_TRUSTED`, não isolado | ✓ |
| **§44** orçamento: `maximumContextBytes` menor que o reservado → step FAILED `AGENT_CONTEXT_BUDGET_EXCEEDED` + evento `agent.context_budget_exceeded` | ✓ |
| **§45** cross-tenant: stepKey allowlistado só existente em Beta → excluído `SOURCE_NOT_FOUND`; segredo de Beta ausente na evidência/eventos de Alpha | ✓ |

O runtime determinístico do 007.3 (`agent-runtime.integration.spec.ts`, 8) permanece verde
com o assembler v2 integrado — sem regressão (sucesso, repair, repair-exhausted, unknown,
canário, cross-tenant de binding, provider-em-produção, reprocessamento).

## Suíte completa (`npm run test:api:integration`) — 29 arquivos, 220 testes, exit 0
Todas as suítes anteriores (identidade/operações/versões/políticas/aprovações/enforcement/
execução/conectores/webhooks/agentes-persistência/runtime) continuam verdes com o pipeline
de contexto v2 integrado (215 → 220 testes, +5 de contexto). Sem regressão.

## Outros gates
typecheck (fe+api+contracts) ✓ · lint (fe+api) ✓ · test:api (378) ✓ · test:api:integration
(220) ✓ · test fe (214) ✓ · a11y (2) ✓ · build (fe+api) ✓ ·
contracts:openapi determinístico — regeneração sem novo diff (apenas os 4 códigos de erro
adicionados) ✓ · migrate deploy/status sem drift · **nenhuma migration criada** (8 migrations,
schema up to date) · seed idempotente (2×, +0) · nenhum SDK de LLM · worker/processor/queue
inalterados funcionalmente.
