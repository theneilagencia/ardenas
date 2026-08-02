# ARDEN-BE-007.2 — Relatório de implementação (persistência de agentes)

Persistência e lifecycle administrativo do domínio contratado no ARDEN-BE-007.1. **Sem
runtime de LLM, SDK, execução de agente, worker ou execução direta.**

## Entidades persistidas (Prisma)

| Model | Escopo | Estado | Chave / unicidade |
| --- | --- | --- | --- |
| `ModelProviderDefinition` | system-managed | ACTIVE/DEPRECATED/DISABLED | `(key, version)` único; `catalogHash` |
| `ModelConfiguration` | tenant | DRAFT/ACTIVE/SUSPENDED/REVOKED (REVOKED terminal) | `revision` desde 1 |
| `AgentDefinition` | tenant | DRAFT/ACTIVE/SUSPENDED/REVOKED (REVOKED terminal) | `(organizationId, key)` único |
| `AgentVersion` | tenant | DRAFT/PUBLISHED/RETIRED (RETIRED terminal) | `(agentDefinitionId, versionNumber)` único; `contentHash` |

Migration única: `prisma/migrations/20260802140000_agents_model_configurations` (enums,
tabelas, FKs `ON DELETE RESTRICT` — sem cascade destrutivo, índices e uniques). Gerada
determinística via `prisma migrate diff`; aplica limpo e sobre o merge do BE-006, sem drift.

## Componentes

| Arquivo | Papel |
| --- | --- |
| `agents/providers/model-provider-catalog.projector.ts` + `project-model-providers.ts` | Projeção idempotente do catálogo de providers (system-managed). |
| `agents/hashing/stable-hash.ts` | SHA-256 canônico (chaves ordenadas). |
| `agents/versions/agent-content-hash.ts` | `contentHash` determinístico do conteúdo funcional da versão. |
| `agents/agent.state-machines.ts` | Transições puras (agent/version/model-config), terminais, imutabilidade. |
| `agents/**/​*.repository.ts` | Repositórios tenant-scoped (`findFirst {id, organizationId}`; `updateGuarded` compare-and-set). |
| `agents/**/​*.service.ts` | Serviços administrativos (create/update/transition/publish/retire). |
| `agents/**/​*.controller.ts` | 22 endpoints contratados. |
| `agents/agents.serializers.ts` | Mappers Prisma→contrato (sem segredo, sem `contentHash`, sem `providerDefinitionId`). |

## Garantias

- **Multitenancy:** toda leitura tenant exige `organizationId` (`findFirst`, nunca
  `findUnique` por id). Cross-tenant retorna 404 (anti-enumeração). Versão só referencia
  configuração do mesmo tenant.
- **Publicação transacional e imutável:** valida agente/config ACTIVE/provider ACTIVE/
  ambiente, calcula `contentHash`, transiciona DRAFT→PUBLISHED guardado por `revision` E
  `status=DRAFT` (só uma publicação concorrente vence), atualiza ponteiro do agente.
  Publicada/retirada não sofrem update de conteúdo.
- **Retirada:** PUBLISHED/DRAFT → RETIRED (terminal). Se era a versão publicada atual,
  limpa `currentPublishedVersionId` (não seleciona versão antiga automaticamente).
- **Idempotência:** reutiliza `runIdempotentCommand` (create/version.create/publish/retire/
  model-config.create + comandos de estado). Mesma key+body → mesmo resultado; body
  diferente → `IDEMPOTENCY_CONFLICT`.
- **Concorrência:** `assertRevision` + `updateMany where revision` → `VERSION_CONFLICT`.
- **Auditoria:** eventos `agent.*` / `agent_version.*` / `model_configuration.*` /
  `model_provider.*` na trilha existente (`audit_events`), metadados sanitizados. Nenhum
  segredo, prompt completo, schema completo ou contexto por default.
- **Provider de teste:** `internal.test-model` (`productionAllowed=false`) permanece
  catalogado em produção, mas NÃO pode ser ativado por configuração nem usado em
  publicação em `NODE_ENV=production` → `MODEL_PROVIDER_DISABLED`.
- **Segredo:** nenhuma tabela guarda segredo; respostas nunca expõem credencial/segredo;
  `credentialConnectionId` é só referência ao cofre (BE-006.4).

## Fora de escopo (confirmado ausente)

Runtime de LLM, SDK de provider, `AgentRuntime`, `AgentStepExecutor`, integração de worker,
context assembly, tool calling, output repair, frontend funcional, endpoint de execução
direta/chat, billing, RAG, embeddings, banco vetorial. Guardado por
`agents-no-runtime.spec.ts`.

## Gates

typecheck (fe+api), lint (fe+api), test (fe 214, api unit 305), test:a11y, build (fe+api),
contracts:openapi sem diff, `migrate deploy`/`migrate status` (sem drift), seed idempotente
(2×). Integração agent (15) verde contra PostgreSQL real. Ver
[`ARDEN_BE_007_PERSISTENCE_TEST_EVIDENCE.md`](./ARDEN_BE_007_PERSISTENCE_TEST_EVIDENCE.md).
