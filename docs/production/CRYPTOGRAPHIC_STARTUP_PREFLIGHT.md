<!-- Milestone: ARDEN-PRD-001.1D -->
# ARDEN-PRD-001.1D — Preflight criptográfico de startup

Fonte ÚNICA compartilhada por API, worker e CLI:
`apps/api/src/security/connector-master-key-preflight.service.ts`
(`ConnectorMasterKeyPreflightService` + `computeConnectorMasterKeyPreflight`).

## Verificações
- keyring tem PRIMARY (`describeKeyring().hasPrimary`);
- todas as `keyVersion` referenciadas por credenciais ACTIVE estão disponíveis;
- `status`: `OK` | `MISSING_VERSIONS` | `NO_PRIMARY` (sanitizado; sem material/tenant/credId).

## API — liveness vs readiness (`health.controller.ts`)
- `GET /health` e `GET /live` (liveness): processo vivo; **não** depende de keyring/banco/
  Anthropic.
- `GET /ready` e `GET /readyz` (readiness): banco (`prisma.ping()`) **+** preflight do
  keyring. Fail-closed → HTTP 503, `status: not_ready`, `checks` sanitizados
  (`database`, `migrations`, `platformSecrets`, `connectorMasterKeyring` = pass/fail).
  Nunca expõe nomes de env, material de chave, credential/tenant IDs ou ciphertext.

## Worker (`execution.worker.ts`)
Antes de adquirir jobs, executa o mesmo preflight (`@Optional`). Keyring inválido →
**não adquire jobs, não renova leases, não marca FAILED** (config global, não defeito do
job); loga uma vez (sanitizado) e volta a operar quando o preflight passa.

## CLI
`master-key:status` reporta primary/decrypt-only/referenced/missing/eligible/preflightStatus
(sem tenant/credential por padrão) e usa exit code 3 quando o preflight não está OK.
