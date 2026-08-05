<!-- Milestone: ARDEN-PRD-001.2A.2 -->
# Catálogo de configuração da aplicação

Classificação fechada de cada parâmetro de produção.

| Variável | Classe |
| --- | --- |
| NODE_ENV, PORT, APP_VERSION, API_PREFIX, LOG_LEVEL, ENABLE_SWAGGER | PUBLIC_CONFIGURATION |
| CORS_ORIGINS, GIT_SHA | PUBLIC_CONFIGURATION |
| DATABASE_URL (runtime, pooler) | PLATFORM_SECRET |
| DIRECT_URL (migrations/admin) | PLATFORM_SECRET |
| CONNECTOR_MASTER_KEY / keyring (CONNECTOR_KEY_VERSION, CONNECTOR_KEYRING_JSON) | PLATFORM_SECRET |
| SESSION_JWT_MATERIAL | PLATFORM_SECRET |
| OBSERVABILITY_TOKEN | PLATFORM_SECRET |
| CONNECTOR_MASTER_KEY_BACKUP_WRAPPING_KEY | PLATFORM_SECRET (só restore-operator) |
| Credenciais de conector (tenant) | TENANT_SECRET (cofre AES-GCM, não passam pela fronteira de plataforma) |
| AUTH_PROVIDER, SUPABASE_* | SENSITIVE_CONFIGURATION |
| Worker concurrency / lease / timeouts | SENSITIVE_CONFIGURATION |
| Trusted proxies, allowed origins | SENSITIVE_CONFIGURATION |
| ANTHROPIC_* gates (todas DISABLED) | SENSITIVE_CONFIGURATION |
| Deploy tokens / OIDC de CI | DEPLOYMENT_ONLY |

## Classes
`PUBLIC_CONFIGURATION` · `SENSITIVE_CONFIGURATION` · `PLATFORM_SECRET` (catálogo fechado
`PLATFORM_SECRET_NAMES`) · `TENANT_SECRET` · `DEPLOYMENT_ONLY`. Segredos nunca no repo;
`value` nunca logado. Runtime usa `DATABASE_URL` (pooler); migrations usam `DIRECT_URL`.
