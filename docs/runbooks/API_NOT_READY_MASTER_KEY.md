<!-- Runbook — ARDEN-PRD-001.1D -->
# Runbook — API not_ready por master key

Sintoma: `GET /ready` → 503, `checks.connectorMasterKeyring: "fail"`.
1. Diagnóstico (sem expor segredo): `master-key:status` → ver `preflightStatus`,
   `missingVersions`, `primaryVersion`.
2. Causas comuns: keyring sem PRIMARY (`NO_PRIMARY`) ou versão referenciada ausente
   (`MISSING_VERSIONS`) após rotação/restore incompleto.
3. Correção: repor a(s) versão(ões) faltante(s) no keyring (config/secret manager) —
   para `MISSING_VERSIONS`, adicionar a versão antiga (DECRYPT_ONLY); para `NO_PRIMARY`,
   definir `CONNECTOR_KEY_VERSION`/`CONNECTOR_MASTER_KEY` corretos.
4. Após corrigir, `master-key:status` = `OK` e `/ready` volta a 200. Não force tráfego com
   readiness=false; não injete default; não trate credencial como vazia.
