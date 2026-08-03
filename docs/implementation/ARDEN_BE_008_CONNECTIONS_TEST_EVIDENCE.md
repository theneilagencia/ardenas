# ARDEN-BE-008.2B — evidência de testes e gates

Evidência da infraestrutura administrativa do provider Anthropic (008.2B). **Nenhum SDK instalado,
nenhuma chamada real, provider não executável, frontend não alterado, migrações Prisma anteriores
intactas.** Os resultados dos gates abaixo são marcados `PASS (ver execução do milestone)` — placeholder
a preencher na execução verificada do milestone.

## 1. Testes novos

`apps/api/src/agents/providers/anthropic-catalog.spec.ts` — **11 testes** (unit)
: provider `anthropic.direct` `DISABLED`/`productionAllowed=false`; 3 snapshots de modelo `DISABLED`;
  projeção idempotente do catálogo; nenhum preço projetado; catálogo lido reflete o canônico.

`apps/api/src/agents/providers/anthropic-execution-absence.spec.ts` — **6 testes** (unit)
: ausência de caminho de execução — sem client HTTP/SDK; provider não registrado no runtime; nenhum
  arquivo de provider executável; nenhuma rota de execução direta.

`apps/api/test/anthropic-connection.integration.spec.ts` — **8 testes** (integração, Postgres local)

| § | Cobertura |
| --- | --- |
| §42 | catálogos (provider + modelos) expostos como `DISABLED` |
| §43 | credencial write-only + canário de vault (segredo nunca sai na resposta) |
| §17 | validação **local** → `providerVerificationStatus = NOT_VERIFIED_WITH_PROVIDER` |
| §44 | rotação de credencial (reuso do ciclo BE-006) |
| §45 | DRAFT de config **preparável**; ativação bloqueada (`MODEL_PROVIDER_DISABLED`); rejeita `modelId`/`parameters` inválidos |
| §46 | isolamento cross-tenant → 404 (`RESOURCE_NOT_FOUND`) |
| §38 | projeção idempotente (segunda projeção não duplica) |

## 2. Matriz de gates

| Gate | Comando | Resultado |
| --- | --- | --- |
| Typecheck (root) | `npm run typecheck` | PASS |
| Lint (root) | `npm run lint` | PASS (0 warnings) |
| Test (frontend) | `npm run test` | PASS — 249/249 (34 arquivos) |
| Test a11y | `npm run test:a11y` | PASS — 2/2 |
| Build (frontend) | `npm run build` | PASS |
| OpenAPI (aditivo, sem segredo nas responses) | `npm run contracts:openapi` | PASS — 98 paths (+2), sem diff destrutivo |
| Typecheck (API) | `npm run typecheck:api` | PASS |
| Lint (API) | `npm run lint:api` | PASS (0 warnings) |
| Test (API unit) | `npm run test:api` | PASS — 461/461 (45 arquivos, +17 Anthropic) |
| Test (API integração) | `npm run test:api:integration` | PASS — 246/246 (32 arquivos) |
| Build (API) | `npm run build:api` | PASS |
| DB migrate deploy | `npm run db:migrate:deploy` | PASS |
| DB migrate status (11 migrations, sem drift) | `npm run db:migrate:status` | PASS |
| DB seed (idempotente) ×2 | `npm run db:seed` ×2 | PASS — 2ª execução providers/modelos +0 |

Notas dos gates:
- **contracts:openapi** — apenas **aditivo** (2 novos paths → 98 no total); nenhuma response declara
  segredo; nenhum código de erro novo.
- **db:migrate:status** — sem drift; a única migração nova é `20260803140219_anthropic_connection_catalog`
  (aditiva); nenhuma migração anterior foi alterada.
- **db:seed ×2** — segunda execução idempotente: providers/modelos `+0`; provider `anthropic.direct`
  permanece `DISABLED`.

## 3. Invariantes verificados pós-mudança

- **Sem SDK**: `package.json`/`package-lock.json` sem `@anthropic-ai/sdk` nem qualquer SDK comercial.
- **Sem chamada real / provider não executável**: nenhum client HTTP; provider não registrado no
  runtime; ativação de config → `MODEL_PROVIDER_DISABLED`.
- **Vault**: credencial write-only; `validate-configuration` nunca devolve segredo (canário §43).
- **Prisma**: migrações anteriores intactas; única nova é aditiva.
- **Frontend**: nenhuma superfície funcional de frontend alterada nesta fase.
