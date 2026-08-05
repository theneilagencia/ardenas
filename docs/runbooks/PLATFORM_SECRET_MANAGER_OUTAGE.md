<!-- Runbook — ARDEN-PRD-001.1B -->
# Runbook — Indisponibilidade do secret manager de plataforma

1. Detecção: alerta `PLATFORM_SECRET_UNAVAILABLE` / readiness=false / startup FAIL.
2. Comportamento correto: **fail-closed** — a aplicação NÃO inicia/NÃO fica ready sem os
   secrets obrigatórios; **sem fallback** para `.env` em produção.
3. Contenção: não forçar boot com material parcial; não desabilitar validação.
4. Recuperação: restaurar disponibilidade do secret manager; readiness volta sozinha quando
   os secrets resolvem.
5. Se prolongado: acionar break-glass documentado do secret manager; registrar incidente.
6. Nunca: commitar secret real, injetar valor default, logar material.

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
