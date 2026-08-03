# ARDEN-BE-007 — Auditoria e encerramento do milestone (agents AI runtime)

Encerramento formal do milestone ARDEN-BE-007: runtime de agentes de IA determinístico,
governado, multitenant e auditável, do contrato à execução como etapa de operação, até
avaliação/usage/custo/governança e o frontend funcional. Este documento consolida o escopo,
os gates finais, a conformidade de escopo (condições de reprovação) e o slice de produção.

## 1. Sub-milestones

| Fase | Entrega | Status |
| --- | --- | --- |
| 007 AUDIT | Escopo, plano de arquitetura, permissões, erros, contratos | PASS |
| 007.1 | Contratos: definição/versão/config/provider + permissões + OpenAPI | PASS |
| 007.2 | Persistência e lifecycle administrativo (sem runtime) | PASS |
| 007.3 | Runtime determinístico (provider interno, structured output, repair) | PASS |
| 007.4 | Montagem de contexto v2 + guardrails (injeção, isolamento, orçamento) | PASS |
| 007.5 | Tool calling funcional (autoridade, aprovação, suspend/resume, BE-006/004) | PASS |
| 007.6 | Avaliação determinística + usage + custo + governança + observabilidade | PASS |
| 007.7 | Frontend funcional (agentes/versões/configs/resultados/uso) sobre a API v1 | PASS |

Linhagem completa na branch canônica `claude/arden-be-007-agents-ai-runtime` (criada de
`86d43c5`, tip do 007.6). Branch histórica `claude/spec-functional-reference-5wxll1`
preservada. Sem force-push; sem branch apagada.

## 2. Gate matrix (final)

| Gate | Resultado |
| --- | --- |
| Root typecheck / lint | PASS / PASS (0 warnings) |
| Root test | **249** testes (34 arquivos) |
| Root a11y / build | PASS / PASS |
| OpenAPI (`contracts:openapi`) | **96 paths** (nenhum endpoint direto de agente) |
| API typecheck / lint / build | PASS / PASS / PASS |
| API unit | **410** testes (40 arquivos) |
| API integração (PostgreSQL + worker reais) | **238** testes (31 arquivos) |
| Migração deploy/status | up to date (10 migrações) |
| Seed ×2 | idempotente (rate cards +0/~19) |

## 3. Conformidade de escopo (condições de reprovação — todas NÃO violadas)

> Corroborado por auditoria independente (9/9 checks PASS com evidência file:line):
> guard tests `agents-no-runtime.spec.ts` (sem SDK, sem rede, sem execução direta),
> `secret-canary.contract.test.ts`, `model-provider-catalog.spec.ts`, `architecture.test.ts`.
> Gating do `internal.test-model` em 3 pontos (resolver + publish + config).

| # | Invariante | Evidência |
| --- | --- | --- |
| 1 | Sem provider comercial/SDK (Anthropic/OpenAI/Bedrock/Vertex/…) | ausente em `package.json` (ambos); único provider é `internal.test-model` (`productionAllowed=false`) |
| 2 | Sem execução direta de agente | única action key é `agent.execute` como etapa de operação; OpenAPI 96 paths sem `/agents/{id}/run|execute|chat|generate` (verificado por `secret-canary.contract.test.ts`) |
| 3 | Sem internet no runtime | provider interno determinístico; tool calls só via `ExternalToolExecutor`/`SecureHttpClient` SSRF-guard (BE-006) |
| 4 | Sem segredo/prompt/instrução persistido | tabelas `agent_*` guardam só hashes/contadores/status (schema BigInt/Int/hash); frontend nunca escreve dados de agente em storage (canário testa localStorage/sessionStorage) |
| 5 | Sem billing/invoice/wallet | ausente; custo é apenas ESTIMADO |
| 6 | Dinheiro só em inteiro (unidade menor) | `estimatedCostMinor` BigInt no backend; `agent-format` só formata; `null` nunca vira "0,00" (testado) |
| 7 | Avaliação final determinística | `AgentEvaluationEngine` (11 checks); `llmJudge` desabilitado/advisory, nunca critério final |
| 8 | Multitenancy | toda consulta filtra `organizationId`; resultado de outro tenant → 404 `AGENT_RESULT_NOT_FOUND` |
| 9 | Regra de arquitetura do frontend | `src/features`/`src/components` acessam dados só via `@/hooks` + `@/application` (`architecture.test.ts` PASS) |
| 10 | Replay não duplica custo/tokens/rollup | rollup incrementa 1× por transição terminal (007.6, testado por replay do worker) |
| 11 | UNKNOWN nunca vira sucesso; output inválido nunca PASSED | `agent-evaluation-engine` + integração 007.6 |

## 4. Slice de produção (fluxo ponta a ponta)

O fluxo canônico completo é exercitado por testes de INTEGRAÇÃO com PostgreSQL 16 + fila
durável + worker reais (sem internet), provando o slice de produção do runtime:

```
providers → model configuration → ativação → agente → versão → políticas → publicação
  → agent.execute em operação publicada → execução → worker
  → [READ tool | WRITE tool → REQUIRE_APPROVAL → suspend → aprovação humana → resume → executa 1×]
  → structured output → avaliação determinística → governança
  → resultado operacional persistido → usage → custo estimado (USD 0 conhecido)
  → evidência + auditoria → consultável pelos endpoints admin e pelo frontend
```

Cobertura por suíte (worker real):
- `agent-runtime.integration.spec.ts` — sucesso, repair, repair-exhausted, unknown, cross-tenant, canário, provider-em-produção bloqueado, replay sem duplicar.
- `agent-context.integration.spec.ts` — injeção bloqueada, isolamento de tool result, orçamento de contexto, cross-tenant, canário.
- `agent-tool-calling.integration.spec.ts` — READ, WRITE com aprovação (suspend/resume, execução única, autorização single-use), DENY, UNKNOWN, injeção via resultado, cross-tenant, canário.
- `agent-governance.integration.spec.ts` — usage+custo (0 conhecido / null+warning), avaliação PASSED/FAILED, rollups por dimensão sem duplicar em replay, consultas admin com filtro/paginação, cross-tenant 404, canário de segredo, métrica terminal única.

Frontend (modo api) lê esses resultados oficiais sem recalcular; testes de componente com
`FakeAgentsRepository` (reflete a OpenAPI real) provam custo conhecido-zero vs indisponível,
versão publicada somente-leitura e ausência de segredo em storage.

## 5. Hardening / segurança

- Superfície de execução: nenhuma rota executa agente/modelo diretamente; tudo passa pela
  action canônica `agent.execute` sob o Gradiente de Autoridade (BE-004) e o executor
  externo SSRF-safe (BE-006).
- Aprovação de tool call: `ActionAuthorization` single-use (ACTIVE→USED atômico), suspensão
  cooperativa e retomada idempotente por checkpoint — sem execução dupla.
- Redação: sinais de segurança e resultados de tool sanitizados/isolados; nenhum artefato
  derivado contém segredo/prompt (canários em todas as suítes).
- Provider interno proibido em produção (`productionAllowed=false`; runtime falha com
  `MODEL_PROVIDER_DISABLED` em `NODE_ENV=production`).
- Concorrência otimista (`expectedRevision`) e idempotência (Idempotency-Key fresca por ação)
  em todas as mutações administrativas.

## 6. Limitações conhecidas / follow-ups (não bloqueantes)

- Editor de binding `agent.execute` na tela de operação e uma tela dedicada de approval/
  resume de tool call no frontend: o endpoint real de resume e o painel de uso por execução
  já existem; os fluxos worker-dependentes são cobertos pelos testes de integração da API.
- E2E Playwright de frontend dos três fluxos (automático/supervisionado/falha): os mesmos
  caminhos são cobertos pela integração da API com worker real.
- Rate cards comerciais reais e provider real chegam com a fase futura (fora do escopo).
- `AgentExecutionResult.evaluationSummary`/`governanceSummary` são colunas `Json` que hoje
  recebem só chaves/status/contadores determinísticos (nenhum conteúdo bruto). Recomenda-se
  um teste de guarda de serialização caso esses campos venham a ser expandidos.
- Dependabot reporta vulnerabilidades no branch default (grupo npm) — endereçadas por PRs
  de dependência separados (ex.: PR #11), fora do escopo funcional deste milestone.

## 7. Encerramento

Milestone ARDEN-BE-007 **PASS**. PR de encerramento aberto da branch canônica para a branch
de referência (base do stack). Sem merge automático. Detalhes de teste em
`ARDEN_BE_007_*_TEST_EVIDENCE.md`; relatórios por fase em `ARDEN_BE_007_*_REPORT.md`.
