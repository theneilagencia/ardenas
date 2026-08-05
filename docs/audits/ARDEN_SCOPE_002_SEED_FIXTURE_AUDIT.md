<!-- Milestone: ARDEN-SCOPE-002 -->
# ARDEN-SCOPE-002.4 — Auditoria de seeds e fixtures

## Corrida corrigida (GAP-008)
`prisma/seed.ts` `seedIdentityCatalog`:
- **Antes:** laço `permission.upsert` (SELECT-then-write) → corrida de unique-constraint sob
  re-seed concorrente (o `resetIdentity` dos testes reexecuta o seed em cada `beforeEach`).
- **Depois:** `permission.createMany({ skipDuplicates: true })` (INSERT … ON CONFLICT DO
  NOTHING atômico); `rolePermission.createMany({ skipDuplicates })`; criação de system-role
  trata `P2002` re-buscando. Idempotente e concorrência-seguro.
- **Evidência:** `test/seed-idempotency.integration.spec.ts` (6 seeds em paralelo, sem
  duplicata, idempotente); suíte de integração **estável 271/271** (antes: 7 falhas
  intermitentes em `identity-authz` sob banco contaminado).

## Estados de demonstração inválidos — verificação
Auditoria dos seeds/fixtures (frontend snapshot, API seed, E2E fixtures):

| Verificação | Resultado |
| --- | --- |
| IDs hardcoded impossíveis | Não encontrados nos caminhos reais (snapshot demo usa IDs sintéticos coerentes) |
| Tenants misturados | Não — snapshot filtra por `organizationId` (`use-session.ts`) |
| Providers ativos indevidamente | Não — `internal.test-model` e Anthropic permanecem `productionAllowed=false` (seed) |
| Modelos disabled usados como ativos | Não — Anthropic catalog nasce DISABLED (provado em E2E api) |
| Operations sem versions / versions publicadas sem gate | Não — publicação exige gate (operations-flow.spec) |
| Agents sem ModelConfiguration | Não — validado em agents-persistence |
| Credentials fake tratadas como reais | Não — vault write-only + canário; fake vault proibido em produção |

Nenhum estado de demonstração inválido bloqueando fluxo real foi encontrado além da corrida
do seed (agora corrigida).

## Idempotência
Seed executado 2× (sequencial) e 6× (paralelo): contagens estáveis, sem duplicata, sem
credencial real, sem provider habilitado, relações preservadas.

## Fixtures E2E
- **canonical/demo:** IndexedDB seed (demo E2E) — determinístico.
- **api real:** `e2e/api/global-setup.ts` aplica migrations + seed + bootstrap (fake identity).
- **security/negative:** canário `sk-ant-e2e-CANARY-…` ausente do DOM (anthropic-admin-api);
  cross-tenant 404 (operations-api).
Fixtures test-only (fake identity, master key de fixture) **não** são usados como evidência
de fluxo produtivo — são explicitamente de teste (`setup-env.ts`, `WELL_KNOWN_TEST_MASTER_KEYS`
bloqueadas em produção).
