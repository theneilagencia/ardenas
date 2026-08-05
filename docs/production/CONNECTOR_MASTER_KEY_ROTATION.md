<!-- Milestone: ARDEN-PRD-001.1B -->
# ARDEN-PRD-001.1B — Rotação da connector master key

## Modelo seguro (sem indisponibilidade)
```
K1 PRIMARY → adicionar K2 (DECRYPT_ONLY) → K2 PRIMARY, K1 DECRYPT_ONLY →
novos secrets cifram com K2 → secrets antigos permanecem legíveis com K1
```
Comprovado por teste (`connector-master-key-lifecycle.spec.ts`): ciphertext de K1 continua
legível após promover K2; novo ciphertext usa K2. **Nenhuma recriptografia imediata de todo
o banco é exigida.**

## Recriptografia (migrar ciphertext antigo → primária)
Processo seguro (projetado; pipeline de banco **STILL_OPEN** nesta fase):
- lote LIMITADO; lock/compare-and-set por credencial (`revision`);
- decifra com a versão registrada; cifra com a primária; atualiza `ciphertext`+`keyVersion`
  atomicamente; não altera metadata funcional;
- registra apenas IDs e versões; idempotente; interrompível e retomável; transações pequenas;
- **não remove a chave antiga automaticamente**.

O núcleo criptográfico (decifra-com-versão-antiga → cifra-com-primária) está implementado e
testado no drill; a orquestração sobre o banco (batch/checkpoint/concorrência) é o item
aberto — ver residual risks.

## Remoção de chave antiga (§17) — só REPORTA elegibilidade
`keyRemovalEligibility` retorna elegível **apenas** com: referências de ciphertext = 0,
backup válido, restore drill PASS e approval humano registrado. **Nunca remove
automaticamente.**

## Comandos operacionais (nomes propostos; wiring STILL_OPEN)
`master-key:status` · `master-key:verify` · `master-key:reencrypt` · `master-key:backup` ·
`master-key:restore:verify` · `master-key:drill` · `secrets:verify`. **Sem endpoint HTTP de
rotação.** Runbook: `docs/runbooks/CONNECTOR_MASTER_KEY_ROTATION.md`.
