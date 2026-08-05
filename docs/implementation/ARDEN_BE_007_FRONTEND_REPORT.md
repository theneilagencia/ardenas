# ARDEN-BE-007.7 — Frontend funcional de agentes

Entrega a administração de agentes no frontend sobre a API v1 real (BE-007.1–.6). **Fonte
de verdade única: API v1** — sem mock/IndexedDB funcional, sem cálculo de custo/avaliação/
usage no browser, sem execução direta de agente.

## Camadas construídas

```
UI (features) → hooks (use-agents) → aplicação (application/agents)
  → repositório (createApiV1AgentsRepository, API-only) → cliente tipado → backend v1
```

| Camada | Arquivos |
| --- | --- |
| Cliente/tipos | `src/services/api/generated/api-v1-client.ts`, `src/services/api/v1-http-client.ts` (métodos de agente) |
| Repositório | `src/services/api/v1-agents-repository.ts` (API-only, idempotência por ação), stub `src/services/repositories/agents-unavailable.ts`; contrato `src/services/contracts.ts` (`AgentsRepository`); fiação `src/services/service-container.ts` |
| Aplicação | `src/application/agents/agents.ts` (`assertPermission` + `getServices().agents`) |
| Hooks | `src/hooks/use-agents.ts` (react-query, `RequestContext` da sessão) |
| Telas | `src/features/agents/{AgentsPage,AgentDetailPage,AgentVersionEditorPage,AgentStatusBadge}.tsx` + `agent-format.ts`; `src/features/model-configurations/ModelConfigurationsPage.tsx`; `src/features/agent-results/{AgentResultsPage,AgentUsagePage}.tsx` |
| Rotas/nav/i18n | `src/app/routes.tsx`, `src/app/modules.ts` (grupo `agents`), namespace `agents` em `src/i18n/locales/{pt-BR,en-US}.ts` |

## Fluxo ponta a ponta

consultar providers → criar configuração de modelo → ativar → criar agente → criar versão
(editor secionado) → definir políticas → publicar (imutável, `contentHash` selado no
servidor) → referenciar em etapa `agent.execute` de uma operação → executar pelo motor →
aprovação de tool call (campos seguros) → resume pelo endpoint real → registro operacional →
usage → custo estimado → avaliação final → governança → evidência/auditoria.

## Invariantes

- API v1 é a única fonte; custo/avaliação/usage/governança nunca recalculados no cliente.
- `estimatedCostMinor: null` → "Custo não disponível"; zero conhecido → formatado.
- Versão publicada imutável (sem PATCH; CTA "criar nova versão").
- Concorrência otimista via `expectedRevision`; idempotência mintada por ação no repositório.
- Nenhum segredo/prompt/instrução persistido no browser; formulários só em memória.
- Providers/configurações de modelo com catálogos fechados (sem API key, sem provider
  comercial); `internal.test-model` marcado somente-teste.
- Tenant sempre da sessão; `assertPermission` é defesa de UX, backend revalida.

## Fora de escopo (explícito)

Sem provider comercial; sem chat/playground; sem execução direta de agente/modelo (só via
etapa `agent.execute`); sem billing/invoice/wallet/payment (custo é **estimado**); sem
LLM-as-judge como critério; sem retrieval/RAG.

Documentação de detalhe em `../frontend/AGENTS_UI_ARCHITECTURE.md` e docs irmãs. Evidência
de teste em `ARDEN_BE_007_FRONTEND_TEST_EVIDENCE.md`.
