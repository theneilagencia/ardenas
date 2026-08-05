# ARDEN-BE-002 — Evidência de Testes

> Comandos e resultados observados localmente (Postgres 16, provider fake). Os mesmos
> gates rodam em CI (`.github/workflows/ci.yml`).

## Resumo

| Suíte | Comando | Resultado |
| --- | --- | --- |
| Backend — unit | `npm run test:api` | **36 testes, 9 arquivos — passou** |
| Backend — integração (Postgres real) | `npm run test:api:integration` | **52 testes, 6 arquivos — passou** |
| Backend — typecheck | `npm run typecheck:api` | passou |
| Backend — lint | `npm run lint:api` | passou |
| Backend — build | `npm run build:api` | passou (`dist/main.js`) |
| Migrações | `npm run db:migrate:deploy` + `:status` | up to date |
| Seed idempotente | `npm run db:seed` (2×) | 41 permissões, 8 papéis (estável) |
| Bootstrap | dry-run / real / repetição | nada em dry-run; idempotente na repetição |
| Frontend — unit + a11y | `npm run test` | **103 testes, 14 arquivos — passou** |
| Frontend — typecheck/lint/build | `npm run typecheck` / `lint` / `build` | passou |
| E2E frontend↔backend (modo api) | `npm run test:e2e:api` | **2 testes — passou** |

## Cobertura por requisito

### Autenticação / token
- `src/identity/fake-identity.provider.spec.ts` — válido, expirado (`SESSION_EXPIRED`),
  prefixo inválido, payload corrompido (`UNAUTHENTICATED`).
- `src/identity/supabase-identity.provider.spec.ts` — **verificação criptográfica real**
  com par de chaves local: assinatura válida aceita; expirado → `SESSION_EXPIRED`;
  issuer errado, audience errada e **algoritmo HS256 não permitido** → `UNAUTHENTICATED`;
  malformado → `UNAUTHENTICATED`. Prova que o token é **verificado, não só decodificado**.
- `src/config/env.schema.spec.ts` — `fake` proibido em production; `supabase` exige JWKS
  e issuer.

### Provisionamento / sessão / autorização (`test/identity-authz.integration.spec.ts`)
- Sem token → 401 com envelope + `correlationId`; token expirado → 401 `SESSION_EXPIRED`;
  token inválido → 401 `UNAUTHENTICATED`.
- JIT: primeiro acesso cria usuário, **sem** org/membership; reautenticar não duplica e
  atualiza e-mail (subject imutável); auditoria `identity.authenticated`.
- Sessão: permissões efetivas computadas; agregação de múltiplos papéis; papel `INACTIVE`
  não concede; usuário `SUSPENDED` → 403; membership `REVOKED` não aparece.
- Organizações: lista só as do usuário; `GET /{id}` exige `organization.view` (403 sem
  permissão); org sem membership → 404 (anti-enumeração) + auditoria de negação;
  `memberships/me` retorna a membership.
- Troca de organização: válida persiste preferência + auditoria; inválida → 404, mantém
  a anterior, auditoria `organization.selection_denied`.
- Auditoria: metadados sensíveis redigidos; catálogo semeado == `ALL_PERMISSIONS`;
  reseed idempotente.

### Multitenancy crítico (`test/multitenancy.integration.spec.ts`)
- A→Alpha, B→Beta, C em ambas (admin em Alpha, auditor em Beta). Isolamento de listagem,
  404 cross-tenant pelo id do path, permissões de C **mudam conforme a organização
  ativa**, papéis não vazam entre orgs.

### Bootstrap e invariantes (`test/bootstrap-constraints.integration.spec.ts`)
- Dry-run não escreve; execução real cria e audita; repetição idempotente; conflito
  material falha. Unicidade de identidade externa, de membership e de papel de sistema
  (índice parcial) garantidas por banco.

### E2E frontend↔backend (`e2e/api/session-api.spec.ts`)
- Com token fake, o frontend em `VITE_DATA_PROVIDER=api` mostra a organização vinda do
  backend real. Sem token, exibe estado de sessão explícito e **nenhuma** organização de
  mock — prova de que o modo api **não** cai para dados simulados.

## Observações de ambiente

- O cluster Postgres local é reiniciado a cada sessão de trabalho
  (`pg_ctlcluster 16 main start`). Bancos: `arden_dev`, `arden_test`.
- Em CI, todos os gates de identidade rodam com `AUTH_PROVIDER=fake` — nunca há
  credenciais reais do Supabase no pipeline.
