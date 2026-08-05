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

---
## Runbook operacional padronizado (ARDEN-PRD-001.2A.2)

### Sintomas
Ver seção específica acima; sinal típico: readiness/preflight fail-closed ou secret manager indisponível.

### Impacto
API/worker sem readiness (fail-closed) até a condição ser resolvida.

### Diagnóstico
`/readyz` (checks sanitizados database + connectorMasterKeyring); `master-key:status`/`secrets:verify`.

### Comandos
- `npm run master-key:status` · `npm run secrets:verify`
- `npm run master-key:verify` · `<provider: secret manager status>`

### Decisões
Fail-closed é intencional: não iniciar/consumir job com keyring inválido ou secret ausente.

### Rollback
Reverter a última mudança de configuração de secret/keyring; promover revisão anterior.

### Escalonamento
Plataforma → segurança (owner) → fornecedor de secret manager.

### Evidência
Timestamps (UTC), correlationId, saída sanitizada; nunca registrar segredo/plaintext.

### Encerramento
Confirmar readiness OK, alertas resolvidos e evidência anexada.
