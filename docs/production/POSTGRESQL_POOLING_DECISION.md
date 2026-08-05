<!-- Milestone: ARDEN-PRD-001.2A -->
# ARDEN-PRD-001.2A — Decisão de pooling do PostgreSQL

Decisão entre `DIRECT_CONNECTIONS` / `SESSION_POOLING` / `TRANSACTION_POOLING` /
`PROVIDER_PROXY`. Fatos remetem a S2 do `ARDEN_PRD_001_2A_SOURCE_REGISTER.md`.

## Evidência de código (o que o Arden.AS realmente faz)

Verificado no repositório nesta fase (somente leitura):

- **Locking de fila e de linha é sempre intra-transação.** `execution.queue.ts:56`
  usa `FOR UPDATE SKIP LOCKED` dentro de `tx.$executeRaw`; `requests.service.ts` e
  `executions.service.ts` usam `SELECT ... FOR UPDATE` dentro de `tx`. Row locks vivem
  **dentro de uma única transação** — compatíveis com transaction pooling.
- **Não há advisory locks de sessão.** Busca por `pg_advisory`/`advisory_lock`: **nenhum
  uso**. (Advisory locks de sessão seriam incompatíveis com transaction pooling.)
- **Leases da fila** são renovadas por `UPDATE` transacional + heartbeat
  (`execution.queue.ts`), não por estado de sessão — compatível com transaction pooling.
- **Prisma datasource** hoje usa apenas `url = env("DATABASE_URL")` (`schema.prisma`),
  **sem `directUrl`**. Nenhum `db push` em produção (comentário no schema).

## Fatos de compatibilidade (S2)

- Prisma opera com PgBouncer em **transaction mode** (S2.1).
- **Migrations exigem conexão direta**: o Schema Engine do Prisma **não** suporta pooling
  via PgBouncer e deve usar `directUrl` (S2.2/S2.3).
- Em **transaction pooling**, `SET`, prepared statements, advisory locks de sessão e
  tabelas temporárias **não sobrevivem** ao limite da transação (S2.2/S2.4).
- PgBouncer ≥ 1.21 suporta prepared statements em transaction mode; com versões
  anteriores, usar `pgbouncer=true` (desliga prepared statements no Prisma) (S2.1).
- Neon (PgBouncer embutido) e Supabase (Supavisor) oferecem endpoint de pooling em
  transaction mode + endpoint direto (S2.4/S2.5).

## Decisão

**`TRANSACTION_POOLING`** para as conexões de aplicação (API + worker), com **conexão
direta separada** para migrations/admin.

Justificativa:
- A aplicação não depende de estado de sessão entre transações (verificado acima), então
  o transaction pooling é seguro e maximiza a densidade de conexões — importante para
  compute que escala horizontalmente (várias réplicas de API/worker) sobre um banco com
  limite de conexões.
- Migrations continuam corretas porque usarão **conexão direta** (não o pooler).
- Se o provedor oferecer proxy gerenciado equivalente (RDS Proxy, ou pooler embutido do
  Neon/Supabase), ele é aceito como implementação de `TRANSACTION_POOLING` — a decisão é
  o **modo**, não o produto.

Alternativas rejeitadas:
- `DIRECT_CONNECTIONS` (sem pooler): esgota o limite de conexões do banco com múltiplas
  réplicas de API/worker; rejeitado para produção.
- `SESSION_POOLING`: não melhora a densidade tanto quanto transaction mode e reintroduz
  acoplamento a estado de sessão; desnecessário aqui.

## Matriz de compatibilidade com o transaction pooling

| Aspecto do Arden.AS | Compatível? | Como |
| --- | --- | --- |
| Prisma Client (runtime) | Sim | Conexão via pooler em transaction mode (S2.1). |
| Prepared statements | Sim, com ressalva | PgBouncer ≥1.21: ok; <1.21 ou provider sem suporte: `pgbouncer=true` (S2.1). |
| `prisma migrate deploy` | Sim | **Conexão direta** via `directUrl` (S2.2/S2.3) — não o pooler. |
| Shadow database (dev) | Sim | Direta (`shadowDatabaseUrl`/config v7). |
| `FOR UPDATE SKIP LOCKED` (fila) | Sim | Intra-transação (`execution.queue.ts:56`). |
| `SELECT ... FOR UPDATE` (aprovações/execuções) | Sim | Intra-transação (`tx.$executeRaw`). |
| Worker leases + heartbeat | Sim | `UPDATE` transacional; sem estado de sessão. |
| Advisory locks de sessão | N/A | Não usados (verificado). |
| Tabelas temporárias | N/A | Não usadas no caminho de execução. |

## Itens de IMPLEMENTAÇÃO (ARDEN-PRD-001.2B — **não** feitos nesta fase)

> Estes itens alteram `schema.prisma`/config e **não** são executados em 001.2A (fase
> documental). Ficam registrados como pré-requisitos de 001.2B:

1. Adicionar **`directUrl`** ao `datasource` do Prisma (ou `prisma.config.ts` na v7) para
   migrations, apontando ao endpoint **direto** do banco; `DATABASE_URL` da aplicação
   aponta ao **pooler** (transaction mode).
2. Definir tamanho de pool do PgBouncer/proxy e `connection_limit` do Prisma coerentes com
   o limite de conexões do plano do banco (dimensionar com nº de réplicas).
3. Se o pooler for PgBouncer < 1.21, incluir `pgbouncer=true` na `DATABASE_URL` da app.
4. Job de migration roda com a **conexão direta**, isolado da app, com privilégio de DDL.
5. Teste de fumaça de pooling: N réplicas × pool → sem esgotar conexões; `SKIP LOCKED`
   continua distribuindo jobs; migration aplica via conexão direta.

## Gate

- Pooling só é considerado "pronto" quando: transaction pooling ativo na app, conexão
  direta separada para migrations, e o teste de fumaça acima passa em staging. Até lá,
  **STILL_OPEN** (implementação em 001.2B).
