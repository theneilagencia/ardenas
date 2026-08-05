<!-- Runbook — ARDEN-PRD-001.1B -->
# Runbook — Rotação da connector master key

1. **Preflight:** `master-key:status` / `master-key:verify` — confirmar keyring válido,
   uma primária, sem `missingVersions`.
2. **Backup atual:** `master-key:backup` — gerar artefato cifrado (wrapping key separada);
   `master-key:restore:verify` deve dar PASS antes de prosseguir.
3. **Adicionar K2:** incluir a nova versão no keyring (config/secret manager) como
   DECRYPT_ONLY; validar.
4. **Promover K2:** definir `CONNECTOR_KEY_VERSION=K2`; K1 vira DECRYPT_ONLY. Readiness deve
   continuar PASS (K1 ainda presente para decifrar ciphertext antigo).
5. **Recriptografar (opcional/gradual):** `master-key:reencrypt` em lotes idempotentes/
   retomáveis; não remove K1.
6. **Elegibilidade de remoção de K1:** só quando referências=0 + backup válido + restore
   drill PASS + approval humano (o comando apenas REPORTA).
> Wiring de CLI/reencrypt sobre o banco: STILL_OPEN (núcleo cripto entregue e testado).
