# Arden.AS — Estratégia de Banco (ARDEN-BE-001)

> PostgreSQL + Prisma. Migrations versionadas. **Sem `db push` como estratégia de
> produção. Sem SQLite.** Nesta issue, apenas tabelas técnicas de fundação.

## Tabelas (técnicas)

- `idempotency_records` — infraestrutura de idempotência (Idempotency-Key). Escopo por
  `(method, path, idempotency_key)`; guarda `request_hash`, `status_code`, `response`,
  `expires_at`. Ainda **não** aplicada a endpoints de negócio (inexistentes).
- `application_metadata` — chave/valor técnico (ex.: versão de schema). Sem segredos.
- `_prisma_migrations` — **ledger de migrações do Prisma**; cumpre o papel de
  `schema_migrations`.

**Nenhuma tabela de negócio** (usuários, organizações, operações, versões, auditoria)
é criada nesta issue.

## Migrations

- Ferramenta: **Prisma Migrate**. Diretório: `apps/api/prisma/migrations/`.
- Migração inicial: `20260731091709_init` (cria as tabelas técnicas).
- `db:migrate` (dev) cria/aplica; `db:migrate:deploy` aplica sem gerar
  (produção/CI); `db:migrate:status` reporta o estado.
- Validada em **banco limpo** (aplica do zero) e em **banco já migrado** (deploy é
  idempotente — "No pending migrations"). Coberto por teste de integração.

### Rollback

Prisma Migrate é *forward-only* por padrão. Para reverter em desenvolvimento:

```bash
npm run db:reset:test          # reset do banco de teste (destrutivo, apenas dev/test)
```

Em produção, um rollback é feito por **nova migração** que desfaz a anterior (ex.:
`DROP TABLE`/`ALTER`), revisada e versionada — **nunca** apagando dados sem decisão
explícita. A migração inicial cria apenas tabelas técnicas vazias; seu "rollback"
lógico é `DROP TABLE idempotency_records; DROP TABLE application_metadata;`.

## Convenções

- Datas em `TIMESTAMPTZ` (UTC).
- IDs opacos (`uuid` para `idempotency_records`).
- `snake_case` no banco (mapeado por `@map`), `camelCase` no client.
- Sem sincronização automática destrutiva (`db push` proibido em produção).
