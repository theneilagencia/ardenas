# ARDEN-BE-006.3 — Evidência de testes (persistência)

Todos os testes usam PostgreSQL real (integração) ou memória (unit). **Sem** internet
real, **sem** segredo real, **sem** plaintext persistido.

## Unit (`npm run test:api`)
`apps/api/src/connectors/`:
- `connector.state-machines.spec.ts` — 5 testes: transições válidas/inválidas +
  terminais das 4 máquinas (conexão, credencial, webhook endpoint/delivery).
- `catalog/connector-catalog.spec.ts` — 4 testes: hash determinístico (ordem de chaves
  irrelevante; conteúdo diferente → hash diferente); projeção idempotente em memória;
  conector removido → DEPRECATED (não apagado); ferramenta removida → disabled.

## Integração (`npm run test:api:integration`)
`apps/api/test/connectors-persistence.integration.spec.ts` — 13 testes:
catálogo projetado (`internal.test` productionAllowed=false, 5 ferramentas); conexão
DRAFT rev 1, leitura/lista tenant-scoped; update com revision; ciclo
DRAFT→ACTIVE→SUSPENDED→ACTIVE→REVOKED; transição inválida; credencial PENDING sem
material cripto + ativação + currentCredentialVersionId; rotação (só 1 ACTIVE);
org binding compatível/incompatível; operation binding alias único + action key
inválida + remoção lógica; webhook endpoint (token 1× / hash persistido / DTO sem
hash); endpoint REVOKED não reativa + delivery dedup; idempotência (replay sem
duplicar); auditoria sem campos de segredo.

`apps/api/test/connectors-critical.integration.spec.ts` — 4 testes CRÍTICOS:
1. **Cross-tenant**: Alpha não lê/binda/referencia recursos de Beta; auditoria não
   mistura tenants.
2. **Revision concorrente**: dois updates `revision=1` → um vence, outro `VERSION_CONFLICT`.
3. **Ativação concorrente de credencial**: duas ativações → exatamente uma `ACTIVE`;
   nenhum plaintext.
4. **Seed/projeção idempotente**: segunda projeção tudo `unchanged`; sem duplicação.

## Mapeamento aos testes exigidos (§20/§21/§22-25)
- Hash determinístico ✓ · projeção idempotente ✓ · conector→deprecated ✓ ·
  tool→disabled ✓ · connection transitions válidas/inválidas ✓ · revoked terminal ✓ ·
  credential transitions + única ACTIVE ✓ · webhook transitions ✓ · delivery
  transitions ✓ · revision + version conflict ✓ · tenant obrigatório ✓ · binding
  incompatível ✓ · actionKey inválida ✓ · alias duplicado ✓ · connection revoked não
  aceita binding ✓ · sem segredo em auditoria ✓ · idempotência ✓ · soft removal ✓ ·
  cross-tenant ✓ · externalDeliveryId dedup ✓ · nenhum plaintext ✓.

## Gates
`typecheck`, `lint`, `test`, `test:a11y`, `build`, `contracts:openapi`,
`typecheck:api`, `lint:api`, `test:api`, `test:api:integration`, `build:api`,
`db:migrate:deploy`, `db:migrate:status`, `db:seed` (2×) — verdes. OpenAPI em
sincronia (determinística). Migração aplica em banco limpo e sobre BE-005.
