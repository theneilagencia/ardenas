# ARDEN-BE-003 — Evidência de Testes

> Inventário dos testes de operações, versões, autoridade, publicação e auditoria.
> Integração roda contra **Postgres real** (`DATABASE_URL` aponta para `arden_test`).
> Os mesmos gates rodam em CI.

## Resumo

| Suíte | Comando | Resultado |
| --- | --- | --- |
| Backend — unit | `npm run test:api` | **55 testes, 12 arquivos — passou** |
| Backend — integração (Postgres real) | `npm run test:api:integration` | **81 testes, 11 arquivos — passou** |
| Backend — typecheck | `npm run typecheck:api` | passou |
| Backend — lint | `npm run lint:api` | passou |
| Backend — build | `npm run build:api` | passou |
| Migrações | `npm run db:migrate:status` | up to date (`…_operations_versions_audit`) |
| OpenAPI em sincronia | `npm run contracts:openapi` | em sincronia (contrato inalterado) |

> Frontend (integração em modo api de operações) e E2E de operações são **adicionados
> separadamente**, em esforço paralelo.

## Unit (55 testes, 12 arquivos) — destaques

- `authority.rules.spec` — regras dos **níveis 1–5**: destrutiva exige
  `destructiveActionsAllowed` + `semanticLevel ≥ 4`; nível ≤ 2 não permite destrutiva;
  nível ≥ 4 exige aprovação; nível 5 exige aprovação **e** justificativa; warning quando
  o nível declarado é menor que o nível máximo das ações.
- `version-diff.spec` — comparação de versões por `path` (diff raso, D-006).
- `publication.validator.spec` — `validate()` retorna `{valid, errors[], warnings[]}`:
  tenant, pertence à operação, é `draft`, operação não arquivada, nome presente,
  definição mínima (`objective`+`expectedResult`), autoridade presente/válida, permissão
  `operation.publish`; erros bloqueiam, warnings não.
- Serializers/defaults neutros, helpers de idempotência/hash de corpo, e demais unidades
  dos services/repositories (12 arquivos no total).

## Integração — Postgres real (81 testes, 11 arquivos) — destaques

- `operations-flow` — criação transacional (operação `draft` rev 1 + 1ª versão neutra +
  ponteiro `currentDraftVersionId` + auditoria `operation.created`/
  `operation_version.created` + idempotência), edição de rascunho, autoridade.
- `operations-rollback` — **teste de rollback obrigatório**: falha injetada no meio da
  publicação deixa a versão ainda `draft`, a operação inalterada, **nenhum** evento de
  sucesso e **nenhum** registro de idempotência.
- `operations-multitenancy` — cenário **A/B/C** (A→Alpha admin, B→Beta auditor, C em
  ambas): isolamento de listagem, 404 cross-tenant pelo id do path, permissões de C
  mudam conforme a org ativa, auditoria não vaza, chaves de idempotência não colidem.
- `operations-concurrency-idempotency` — `expectedRevision`/`If-Match` com guarda
  `updateMany WHERE revision=expected`: dois updates concorrentes → primeiro vence,
  segundo `409 VERSION_CONFLICT`, sem *lost update*; replay de idempotência (mesmo corpo)
  e `409 IDEMPOTENCY_CONFLICT` (corpo diferente).
- `operations-lifecycle` — pause/resume (idempotente por estado), archive (via
  `operation.edit`), duplicate, criação/edição de versões, compare, e checagens de
  permissão por endpoint.
- Demais arquivos cobrem publicação bem-sucedida (supersede da anterior, retorno
  `{version, operation, auditEvents}`), leitura de auditoria por cursor + filtros, e
  isolamento de detalhe de auditoria (cross-tenant → 404).

## O que cada prova sustenta (rastreio às FALHAS)

| Prova | FALHA coberta |
| --- | --- |
| `operations-rollback` | rollback parcial; publicação multi-transação; idempotência duplicada |
| `operations-multitenancy` (A/B/C) | query só por id; tenant no body; auditoria vazando; idempotência colidindo entre orgs |
| `operations-concurrency-idempotency` | sobrescrita por concorrência; idempotência duplicada |
| `authority.rules.spec` / `publication.validator.spec` | gradiente decorativo; publicação inválida |
| `operations-flow` / `operations-lifecycle` | operação sem tenant; mutar versão publicada; permissões do frontend |

## Comandos

```bash
npm run test:api               # unit (55)
npm run test:api:integration   # integração Postgres real (81)
npm run typecheck:api
npm run lint:api
npm run build:api
npm run db:migrate:status      # migração operations_versions_audit aplicada
npm run contracts:openapi      # OpenAPI v1 em sincronia (inalterada)
```

## Observações de ambiente

- Integração usa `DATABASE_URL` apontando para o Postgres `arden_test`.
- O contrato v1 (`docs/api/openapi-v1.yaml`) **não** foi alterado nesta issue; os
  endpoints implementados batem com ele.

Ver `ARDEN_BE_003_OPERATIONS_REPORT.md` e os docs de backend/domínio referenciados.
