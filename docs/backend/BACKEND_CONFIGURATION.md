# Arden.AS — Configuração do Backend (ARDEN-BE-001)

> Toda configuração vem de variáveis de ambiente, validada por Zod
> (`apps/api/src/config/env.schema.ts`). **A aplicação não inicia** com variável
> obrigatória ausente/inválida. Segredos nunca são logados nem commitados.

## Variáveis

| Variável | Obrigatória | Default | Descrição |
|---|---|---|---|
| `NODE_ENV` | não | `development` | `development` \| `test` \| `production` |
| `PORT` | não | `3000` | Porta HTTP |
| `DATABASE_URL` | **sim** | — | Conexão PostgreSQL (`postgres://…`) |
| `LOG_LEVEL` | não | `info` | `fatal`…`trace` \| `silent` |
| `APP_VERSION` | não | `0.1.0` | Versão exposta em `/health` e `/api/v1/meta` |
| `CORS_ORIGINS` | não* | `` | Allowlist separada por vírgula |
| `API_PREFIX` | não | `/api/v1` | Prefixo dos endpoints de negócio |
| `ENABLE_SWAGGER` | não | `true` | Serve `/api/docs` |
| `GIT_SHA` | não | `` | Commit exposto em `/api/v1/meta` |

\* Em **production**, `CORS_ORIGINS` deve ser uma allowlist explícita (**sem `*`** e
não vazia) — caso contrário a aplicação **não inicia**.

## Regras de validação

- `DATABASE_URL` deve começar com `postgres://`/`postgresql://` (SQLite é proibido).
- `PORT` é coagido a inteiro em `[1, 65535]`.
- Defaults existem apenas para valores seguros.
- Mensagens de erro de configuração são claras e listam cada problema.

## Segredos

- `apps/api/.env` está no `.gitignore` — **nunca** commitado.
- Use `apps/api/.env.example` como referência (sem segredos reais).
- Em produção, use variáveis de ambiente ou um secret manager.
- `Authorization`, cookies e tokens são **redigidos** dos logs (ver
  `BACKEND_ERROR_AND_LOGGING_STANDARD.md`).
