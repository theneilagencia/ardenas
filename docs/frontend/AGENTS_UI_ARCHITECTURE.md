# Arquitetura da UI de agentes (ARDEN-BE-007.7)

Frontend funcional de administração de agentes. **Fonte de dados única: API v1.** Não há
mock/IndexedDB funcional para agentes — sem organização ativa, o repositório lança erro
tipado (`agents-unavailable.ts` é só stub). Custo, avaliação, usage e governança chegam
prontos do servidor e **nunca** são recalculados no browser.

## Camadas (fluxo de dependência unidirecional)

```
UI (src/features/*)              telas; nunca importam services/repositories direto
  → hooks (src/hooks/use-agents) react-query; injetam RequestContext da sessão
  → aplicação (src/application/agents) assertPermission + getServices().agents
  → repositório (service-container) createApiV1AgentsRepository — API-only
  → cliente tipado (api-v1-client + v1-http-client) → backend v1
```

Regra de arquitetura (verificada em `src/test/architecture.test.ts`): componentes/features
**não** importam `services/`/repositórios. A UI só fala com hooks; hooks só falam com a
camada de aplicação.

## Tenant vem sempre da sessão

O `organizationId` **nunca** é digitado em formulário. `useOrgCtx()` (em `use-agents.ts`)
deriva o tenant de `useTenant().activeOrganization`; a query só habilita (`enabled`) com
organização ativa e `RequestContext` presente. No repositório, `requireOrg()` lê
`getActiveOrganizationId()` da sessão. Sem organização → `UNAVAILABLE`.

## Padrão query/hook

- Leitura: `useQuery` com `queryKey: [dominio, organizationId, filtros]` — a org na chave
  isola o cache por tenant.
- Mutação: `useMutation` chamando o caso de uso; `onSuccess` invalida as chaves afetadas.
- Erros normalizados para `ArdenRepositoryError` (`FORBIDDEN`, `CONFLICT`, `UNAVAILABLE`…);
  a UI mostra "sem permissão" / "conflito" / retry.

## Defesa de permissão em duas camadas

`assertPermission(ctx, 'agent.*')` na camada de aplicação é **defesa de UX** (esconde e
protege ações). O backend **revalida** toda ação — a checagem no cliente nunca é a
autoridade final. Permissões usadas: `agent.view/create/edit/suspend/revoke/publish`,
`model_provider.view`, `model_configuration.view/create/edit/revoke`, `agent.cost.view`.

## Segurança de dados

Nenhum prompt/instrução/segredo é colocado em cache (react-query, Zustand persistido,
IndexedDB, localStorage). As respostas da API não ecoam segredo; os formulários mantêm
rascunho **só em memória transitória**. Ver `AGENT_FRONTEND_SECURITY.md`.
