<!-- Milestone: ARDEN-PRD-001 -->
# ARDEN-PRD-001 — Secrets e gestão de chaves

## Estado atual
Config validada em `apps/api/src/config/env.schema.ts` (falha cedo em variável ausente/
inválida). Secrets são **variáveis de ambiente**; não há secret manager externo. Vault de
credenciais AES-256-GCM em `apps/api/src/connectors/vault/`. **MISSING**: secret manager,
rotação automatizada, break-glass, backup/DR das chaves de criptografia.

## Inventário de secrets

| Secret | Escopo | Ambiente | Consumidor | Rotação | Dono |
| --- | --- | --- | --- | --- | --- |
| `DATABASE_URL` | infra | todos | API, worker, migrations | por provedor gerenciado | plataforma |
| `CONNECTOR_MASTER_KEY` | cofre | dev/test/stg/prod (isolada) | vault (`connector-key-provider.ts`) | **crítica — ver abaixo** | segurança |
| `CONNECTOR_KEYRING_JSON` | cofre (multi-versão) | opcional | vault | por versão | segurança |
| Session/auth (`SUPABASE_*`/JWKS) | auth | stg/prod | `authentication.guard.ts` | por IdP | plataforma |
| OAuth/IdP credentials | auth | stg/prod | IdP | por IdP | plataforma |
| Webhook secrets | connector | por tenant | webhooks | por tenant (write-only) | tenant |
| Provider credentials (Anthropic) | tenant | (bloqueado em prod) | vault | tenant (rotation existente) | tenant |
| Observability tokens | infra | stg/prod | exporters | por provedor | plataforma |

## Requisitos
- **Cloud secret manager** (AWS Secrets Manager / GCP Secret Manager / Vault) com injeção
  em runtime, rotação, revogação, audit, acesso mínimo, separação por ambiente, break-glass.
- **Nunca** commitar secret real. A única chave versionada é a **fixture pública de teste**
  (`env.schema.ts` `WELL_KNOWN_TEST_MASTER_KEYS`), recusada em production.

## `CONNECTOR_MASTER_KEY` — requisito crítico (P0)
Evidência: `connector-key-provider.ts:25` decodifica a master key; credenciais são cifradas
com ela. **A perda da master key = perda de acesso a TODAS as credenciais cifradas.**

| Questão | Definição proposta |
| --- | --- |
| Armazenamento | secret manager, namespace por ambiente, acesso mínimo |
| Versionamento | keyring multi-versão (`CONNECTOR_KEYRING_JSON`); `keyVersion` gravado nos metadados da credencial |
| Rotação | adicionar nova versão ao keyring, re-cifrar credenciais no futuro; versão antiga mantida enquanto houver credencial que a use |
| Descriptografia de credenciais antigas | resolvida por `keyVersion` persistido — versão antiga não pode ser removida do keyring até re-cifrar |
| Backup da chave | backup cifrado do secret manager, cross-region, acesso quebra-vidro |
| Restore testado | **DR drill obrigatório** (ver `DISASTER_RECOVERY.md`) |
| Acesso | somente break-glass + auditoria |
| Perda da chave | **RISCO CRÍTICO** — credenciais tornam-se irrecuperáveis; tenants precisam re-inserir credenciais write-only |
| Isolamento de ambiente | cada ambiente tem master key própria; produção nunca aceita fixture de teste |

**Classificação de risco: P0 crítico.** Registrado em `ARDEN_PRD_001_RISK_REGISTER.md`.
