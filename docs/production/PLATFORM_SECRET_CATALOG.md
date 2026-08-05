<!-- Milestone: ARDEN-PRD-001.1A -->
# ARDEN-PRD-001.1A — Inventário e catálogo de secrets

Inventário factual com evidência `file:line`. Separação rigorosa **platform** vs.
**tenant-managed**.

## Secrets de PLATAFORMA (pertencem ao ambiente Arden)

| Secret | Consumidor | Escopo | Fonte atual | Obrigatório | Rotacionável | Impacto de perda |
| --- | --- | --- | --- | --- | --- | --- |
| `DATABASE_URL` | API, worker, migrations | platform | env (`config/env.schema.ts:34`) | sim | por provedor | indisponibilidade total |
| `CONNECTOR_MASTER_KEY` (+ `CONNECTOR_KEY_VERSION`) | vault (`connectors/vault/connector-key-provider.ts:25`) | platform | env / keyring | sim (app-aes-gcm) | **sim (keyring versionado)** | credenciais tenant irrecuperáveis |
| `CONNECTOR_KEYRING_JSON` | vault (versões antigas) | platform | env (`env.schema.ts:71`) | opcional | sim | perda de decrypt de versões antigas |
| `CONNECTOR_MASTER_KEY_BACKUP_WRAPPING_KEY` (novo) | backup da keyring (`security/connector-master-key-backup.ts`) | platform | PlatformSecretSource | sim p/ backup | sim | backup irrecuperável (mas master key intacta) |
| Session/JWT material (`SUPABASE_*`/JWKS) | `authz/guards/authentication.guard.ts` | platform | env (`env.schema.ts:54-58`) | sim (supabase) | por IdP | sessões inválidas |
| Observability token | exporters (futuro) | platform | env | opcional | por provedor | perda de telemetria |

## Secrets TENANT-MANAGED (pertencem às organizações — continuam no SecretVault)

| Secret | Escopo | Fonte | Cifrado por |
| --- | --- | --- | --- |
| Connector API keys / credentials | tenant | SecretVault (`connectors/vault/`) | master key (AES-256-GCM) |
| Anthropic API keys | tenant | SecretVault | master key |
| Webhook signing secrets | tenant | write-only | master key |
| Integration tokens | tenant | SecretVault | master key |

**Invariante:** tenant-managed secrets **nunca** passam pelo `PlatformSecretSource`; são
cifrados pela master key e resolvidos pelo `credential-resolver.ts`. A separação é física
(módulos distintos) e conceitual (catálogo fechado de platform vs. cofre por-tenant).

## Pontos de uso de `process.env` / secrets (grep, evidência)
- `apps/api/src/config/env.schema.ts` — única porta de leitura/validação de env (falha cedo).
- `apps/api/src/connectors/vault/connector-key-provider.ts:25` — decodifica master key/keyring.
- `apps/api/src/security/platform-secret-source.ts` — nova fronteira neutra (env adapter +
  fail-closed de produção).
- Nenhum `process.env` de secret espalhado fora da config (validado por grep §5).
