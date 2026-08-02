# ARDEN-BE-007.2 — Evidência de testes (persistência de agentes)

## Ambiente
PostgreSQL 16 real (cluster local). `DATABASE_URL`/`TEST_DATABASE_URL` → `arden_test`.
`AUTH_PROVIDER=fake` (teste). Migrations aplicadas via `prisma migrate deploy`.

## Migrations e seed (§37)
- `migrate deploy` em banco limpo: 8 migrations aplicadas, incluindo
  `20260802140000_agents_model_configurations`. `migrate status`: **sem drift**.
- `db:seed` executado 2×: idempotente — run 1 `providers (+1/~0)`, run 2 `providers (+0/~1)`;
  `internal.test-model` persistido com `production_allowed=false` (1 linha).
- Migrations anteriores não editadas; sem cascade destrutivo (FKs `ON DELETE RESTRICT`).

## Testes unitários (`npm run test:api`) — 305 passed
Inclui os novos specs de agentes:
- `agent.state-machines.spec.ts` — transições, terminais, published↛draft, retired↛published.
- `versions/agent-content-hash.spec.ts` — hash determinístico (ordem-independente) e muda com conteúdo.
- `providers/model-provider-catalog.spec.ts` — projeção cria/idempotente/deprecated; test provider productionAllowed=false.
- `agents.serializers.spec.ts` — responses sem segredo/contentHash/providerDefinitionId.
- `agents-no-runtime.spec.ts` — sem SDK de LLM, sem executor de agente, sem rota run/chat/generate.

## Testes de integração (PostgreSQL real) — 15 passed
`agents-persistence.integration.spec.ts` (10) + `agents-critical.integration.spec.ts` (5):

| Cobertura | Resultado |
| --- | --- |
| Projeção de providers + idempotência | ✓ |
| Model config: create(DRAFT)/activate/suspend/reactivate/revoke; revoked terminal | ✓ |
| Provider inexistente na criação (404 MODEL_PROVIDER_NOT_AVAILABLE) | ✓ |
| Agente: create; versão draft; update com revisão; publicar; imutabilidade (409) | ✓ |
| Publicar com config inativa (409 MODEL_CONFIGURATION_NOT_ACTIVE) | ✓ |
| Nova versão a partir de publicada (versionNumber 2); retire + ponteiro limpo | ✓ |
| Conflito de revisão (VERSION_CONFLICT); agente revogado terminal (AGENT_REVOKED) | ✓ |
| Idempotência (replay = mesmo id; body diferente = IDEMPOTENCY_CONFLICT) | ✓ |
| Paginação e filtro de status | ✓ |
| **§32** Publicação concorrente: uma vence (200), outra conflita (409); PUBLISHED uma vez; auditoria única | ✓ |
| **§33** Imutabilidade: PATCH em publicada falha; contentHash e revisão preservados; sem auditoria de update | ✓ |
| **§34** Cross-tenant: Alpha não lê agente de Beta (404); versão não usa config de outro tenant (404) | ✓ |
| **§35** Segredo: canário injetado ausente de response, auditoria e linha persistida | ✓ |
| **§36** Provider de teste em produção: catalogado, mas activate bloqueado (409 MODEL_PROVIDER_DISABLED) | ✓ |

## Suíte de integração completa (`npm run test:integration`)
Executada contra o mesmo PostgreSQL — todas as suítes anteriores continuam verdes
(identidade, operações, versões, políticas, aprovações, enforcement, execução, conectores,
webhooks) junto das novas de agentes. Sem regressão.

## Outros gates
typecheck (fe+api) ✓ · lint (fe+api) ✓ · test (fe 214) ✓ · test:a11y ✓ · build (fe+api) ✓ ·
contracts:openapi determinístico sem diff ✓.
