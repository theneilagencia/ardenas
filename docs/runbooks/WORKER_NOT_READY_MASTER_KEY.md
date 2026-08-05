<!-- Runbook — ARDEN-PRD-001.1D -->
# Runbook — Worker não consome jobs por master key

Sintoma: worker vivo, mas sem processar jobs; log "preflight da master key inválido".
1. É **fail-closed intencional**: com keyring inválido, o worker não adquire jobs, não
   renova leases e **não** marca jobs como FAILED.
2. Diagnóstico: `master-key:status` (mesmo preflight da API).
3. Correção: repor versões faltantes/definir PRIMARY (ver API_NOT_READY_MASTER_KEY).
4. Quando o preflight volta a `OK`, o worker retoma a aquisição automaticamente. Jobs
   pendentes permanecem na fila (leases expiram e são recuperados normalmente).

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
