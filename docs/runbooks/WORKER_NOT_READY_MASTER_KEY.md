<!-- Runbook — ARDEN-PRD-001.1D -->
# Runbook — Worker não consome jobs por master key

Sintoma: worker vivo, mas sem processar jobs; log "preflight da master key inválido".
1. É **fail-closed intencional**: com keyring inválido, o worker não adquire jobs, não
   renova leases e **não** marca jobs como FAILED.
2. Diagnóstico: `master-key:status` (mesmo preflight da API).
3. Correção: repor versões faltantes/definir PRIMARY (ver API_NOT_READY_MASTER_KEY).
4. Quando o preflight volta a `OK`, o worker retoma a aquisição automaticamente. Jobs
   pendentes permanecem na fila (leases expiram e são recuperados normalmente).
