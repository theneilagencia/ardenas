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
