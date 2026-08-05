<!-- Milestone: ARDEN-PRD-001 -->
# ARDEN-PRD-001 — Estratégia de ambientes

Estado atual: existem `local`, `test` e `CI` (`NODE_ENV` em `apps/api/src/config/env.schema.ts:19`).
`staging` e `production` **NOT FOUND**. Proposta (documental):

| Ambiente | Objetivo | Dados | Integrações | Secrets | Observabilidade | Deploy | Migrations | Backups | Anthropic |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| local | dev | sintéticos | fake providers | `.env` local + fixture master key | logs stdout | manual | `migrate dev` | não | DISABLED |
| test/CI | gates | efêmeros | fake | fixture master key (só test) | logs | efêmero | `migrate deploy` em DB descartável | não | DISABLED |
| development (compartilhado) | integração de time | sintéticos | fake/sandbox | secret manager (namespace dev) | logs+metrics | automático | gate | opcional | DISABLED |
| staging | pré-produção idêntica | baixo risco/sintéticos | sandbox | secret manager (namespace staging) | igual produção | automático via CI | gate + rehearsal | sim | DISABLED |
| production | operação | reais (multi-tenant) | produção (Anthropic em DENY) | secret manager (namespace prod, acesso mínimo) | externa completa | promoção com approval | gate + rehearsal + rollback | sim + PITR | **DISABLED/BLOCKED** |

## Necessidade
`local`+`test` já existem. `staging` e `production` são **obrigatórios**. `development`
compartilhado é **opcional** (pode ser substituído por preview environments efêmeros).
Recomendação: mínimo `staging` + `production`; adicionar `development` só se o time
precisar de integração contínua fora de CI.

## Regras invariantes
- Produção mantém Anthropic **DISABLED** e egress Anthropic em **DENY** até os gates
  deferidos (`ANTHROPIC_PRODUCTION_DEFERRED_GATES.md`).
- A fixture `CONNECTOR_MASTER_KEY` é **recusada em production** (`env.schema.ts`
  `WELL_KNOWN_TEST_MASTER_KEYS`, `env.schema.spec.ts`) — cada ambiente tem sua própria
  master key isolada.
- Nenhum ambiente compartilha secret com outro (separação por namespace).

## Decisões externas necessárias
- Provedor de cada ambiente (`REQUIRES EXTERNAL DECISION` — ver `DEPLOYMENT_AND_PROMOTION.md`).
- Política de dados de staging (sintéticos vs. anonimizados de produção).
