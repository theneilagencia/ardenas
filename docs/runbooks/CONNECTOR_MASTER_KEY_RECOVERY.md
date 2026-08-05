<!-- Runbook — ARDEN-PRD-001.1C -->
# Runbook — Recuperação da connector master key

**Cenário crítico:** perda da master key = credenciais tenant irrecuperáveis.

1. Obter o artefato de backup cifrado (storage/secret manager) e a **wrapping key**
   (`CONNECTOR_MASTER_KEY_BACKUP_WRAPPING_KEY`) do `PlatformSecretSource` — armazenados
   **separadamente**.
2. `master-key:restore:verify` num ambiente isolado: valida formato/checksum/auth-tag,
   decifra em isolamento, valida o keyring, testa decrypt com fixture. Deve dar PASS.
3. Reinjetar o keyring recuperado no ambiente-alvo (config/secret manager).
4. Readiness/preflight deve passar; credenciais voltam a decifrar.
5. Se a master key for irrecuperável (sem backup válido): produção permanece fail-closed;
   tenants re-inserem credenciais write-only (rotation/create). Registrar incidente
   (`INCIDENT_RESPONSE.md`, master key compromise/loss).
