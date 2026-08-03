# ARDEN-BE-007.7 — Evidência de testes (frontend funcional de agentes)

Todos os gates executados nesta sessão. O frontend de agentes usa a API v1 real (nenhum
mock funcional/IndexedDB/Zustand persistido como fonte dos fluxos de agentes). Sem internet
real; provider comercial ausente.

## Gates (§59) — todos PASS

| Gate | Comando | Resultado |
| --- | --- | --- |
| Root typecheck | `npm run typecheck` | PASS |
| Root lint | `npm run lint` | PASS (0 warnings) |
| Root test | `npm run test` | 30 arquivos, **237** testes PASS |
| Root a11y | `npm run test:a11y` | 2 testes PASS |
| Root build | `npm run build` | PASS |
| OpenAPI | `npm run contracts:openapi` | **96 paths** (inalterado — nenhum endpoint novo) |
| API typecheck | `npm -w apps/api run typecheck` | PASS |
| API lint | `npm -w apps/api run lint` | PASS (0 warnings) |
| API unit | `npm -w apps/api run test` | 40 arquivos, **410** testes PASS |
| API integração | `npm -w apps/api run test:integration` | 31 arquivos, **238** testes PASS |
| API build | `npm -w apps/api run build` | PASS |
| Migração deploy/status | `db:migrate:deploy` / `:status` | up to date (10 migrações) |
| Seed ×2 | `db:seed` | idempotente (rate cards +0/~19) |
| Arquitetura | `src/test/architecture.test.ts` | PASS (features não importam repositórios) |

## Testes de frontend novos

- **`agent-format.test.ts`** (unit) — custo 0 conhecido → "0,00" (nunca indisponível);
  custo `null` → COST_UNAVAILABLE (nunca "0,00"); conversão de unidade menor sem float
  (`0.1`+`0.2` = 30 minor); roundtrip `toMinorUnits`/`fromMinorUnits`.
- **`AgentResultsPage.test.tsx`** (componente) — custo 0 conhecido exibe "0,00" e NÃO
  "não disponível"; custo `null` exibe "Custo não disponível" e NÃO "0,00"; estado de
  erro com retry. Prova a distinção crítica §52 e que o custo vem pronto da API.
- **`AgentVersionEditorPage.test.tsx`** (componente) — versão PUBLISHED é somente
  leitura (aviso imutável + CTA "criar nova versão"; sem botão publicar; nenhum PATCH
  enviado, §53); canário de instrução ausente de localStorage/sessionStorage (§51).
- **`AgentsPage.test.tsx`** (componente) — lista real via API; estado vazio; criação
  gated por permissão.

Todos usam `FakeAgentsRepository` (reflete a OpenAPI real) injetado via `setServices`,
com `MockSessionRepository` + `TenantProvider` + react-query — o mesmo harness dos testes
de integrações (ARDEN-BE-006.8).

## Condições de reprovação (§61) verificadas como NÃO violadas

- Frontend de agentes usa API v1 (repositório API-only; stub indisponível em mock/IndexedDB).
- Custo/avaliação/usage NUNCA recalculados no browser — só formatação de exibição.
- Custo desconhecido (`null`) ≠ zero; nunca mostrado como "0,00".
- Versão publicada imutável (somente leitura; sem PATCH; CTA nova versão).
- Nenhum segredo/prompt/instrução persistido no browser (canário verifica storage).
- Sem execução direta de agente; sem endpoint direto (OpenAPI 96 paths inalterado).
- Sem provider comercial, sem campo de API key; provider interno marcado somente-teste.
- `expectedRevision` em todas as mutações; idempotency key fresca por ação no repositório.
- Branch histórica preservada; branch canônica criada; sem force-push.

## Cobertura parcial (transparência)

Documentado como pendência no relatório: editor de tool aliases por operação acoplado ao
binding `agent.execute` na tela de operação; tela dedicada de approval de tool call
(reutiliza o fluxo BE-004/005 existente e o endpoint real de resume; `useExecutionAgentUsage`
já expõe o resultado por execução no detalhe da execução); testes E2E Playwright dos fluxos
automático/supervisionado/falha (os mesmos caminhos são cobertos por testes de integração
da API com PostgreSQL + worker reais no backend 007.3–007.6).
