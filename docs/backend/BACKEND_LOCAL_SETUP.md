# Arden.AS — Setup Local do Backend (ARDEN-BE-001)

## Pré-requisitos

- Node.js ≥ 22
- Docker (para PostgreSQL) **ou** um PostgreSQL 16 local

## Passos

```bash
# 1. Instalar dependências do monorepo (na raiz)
npm ci

# 2. Configurar o ambiente da API
cp apps/api/.env.example apps/api/.env
#   ajuste DATABASE_URL se necessário

# 3. Subir o PostgreSQL (via Docker Compose)
npm run docker:up            # postgres (e api, se desejar)
#   ou use um PostgreSQL local escutando em 5432

# 4. Gerar o Prisma Client e aplicar a migração inicial
npm run db:generate
npm run db:migrate           # cria as tabelas técnicas

# 5. Rodar a API em desenvolvimento
npm run dev:api              # http://localhost:3000
```

## Verificação rápida

```bash
curl localhost:3000/health           # {"status":"ok",...}
curl localhost:3000/ready            # checa o banco
curl localhost:3000/api/v1/meta      # versão/ambiente/commit
curl localhost:3000/api/docs/openapi.json | head
```

## Scripts (a partir da raiz)

| Script | Ação |
|---|---|
| `npm run dev:api` | API em watch mode |
| `npm run build:api` | Compila a API (dist) |
| `npm run start:api` | Executa a API compilada |
| `npm run typecheck:api` / `lint:api` | Typecheck / lint do backend |
| `npm run test:api` / `test:api:integration` | Testes unitários / de integração |
| `npm run db:generate` | Gera o Prisma Client |
| `npm run db:migrate` | Cria/aplica migração (dev) |
| `npm run db:migrate:deploy` | Aplica migrações (produção/CI) |
| `npm run db:migrate:status` | Estado das migrações |
| `npm run db:reset:test` | Reseta o banco de teste |
| `npm run docker:up` / `docker:down` | Sobe / derruba o Compose |

## Docker Compose completo (API + Postgres)

```bash
npm run docker:up            # build da imagem da API + postgres
curl localhost:3000/health
npm run docker:down
```

Detalhes de configuração em `BACKEND_CONFIGURATION.md`.
