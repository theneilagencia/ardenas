<!-- Milestone: ARDEN-PRD-001.1B -->
# ARDEN-PRD-001.1B — Readiness e preflight criptográfico

## Liveness vs. readiness (existente: `health.controller.ts`)
- `/health` (liveness): processo vivo; não depende de integração externa não crítica.
- `/ready` (readiness): `prisma.ping()` hoje. **Proposta:** incluir o preflight do keyring.

## Preflight (implementado, puro)
`preflightKeyring(keyring, referencedCiphertextVersions)` valida invariantes e detecta
`missingVersions`. `status: MISSING_VERSIONS` deve tornar `/ready` = 503 e o worker
readiness = false (fail-closed). **Não** decifra secrets em cada health check.

## Integração (STILL_OPEN)
O wiring do preflight ao `/ready` e ao startup do worker (com a query real de
`referencedCiphertextVersions` via `keyVersion` das credenciais) é o item aberto desta fase.
O núcleo puro + testes está entregue. Ver `ARDEN_PRD_001_1_RESIDUAL_RISKS.md`.

---
## Atualização ARDEN-PRD-001.1D (CLOSED)
Integração de readiness ENTREGUE: `/ready`+`/readyz` incluem o preflight do keyring
(`ConnectorMasterKeyPreflightService`), fail-closed 503 com `checks` sanitizados; worker
não consome jobs com keyring inválido (`execution.worker.ts`, `@Optional`). Ver
`CRYPTOGRAPHIC_STARTUP_PREFLIGHT.md`.
