<!-- Runbook — ARDEN-PRD-001.1B -->
# Runbook — Recriptografia de secrets de conector

Objetivo: migrar ciphertext de uma versão antiga para a primária, sem indisponibilidade.
1. Confirmar keyring com primária nova + versão antiga presente (DECRYPT_ONLY).
2. `master-key:reencrypt --from <oldVersion>` em **lotes pequenos**; cada credencial:
   compare-and-set por `revision`; decifra com versão registrada; cifra com a primária;
   atualiza `ciphertext`+`keyVersion` atomicamente.
3. Idempotente e retomável (checkpoint de lote); pula registros já migrados/alterados.
4. Tolera: credencial rotacionada durante o processo, connection revogada, dois processos,
   worker lendo credencial, retry após crash.
5. Ao final, `master-key:status` mostra referências da versão antiga = 0 → elegível para
   remoção (com backup + drill + approval).
> Orquestração sobre o banco: STILL_OPEN. O núcleo cripto/idempotência está no drill testado.
