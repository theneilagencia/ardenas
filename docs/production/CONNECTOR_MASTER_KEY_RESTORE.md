<!-- Milestone: ARDEN-PRD-001.1C -->
# ARDEN-PRD-001.1C — Restore e verificação

`restoreConnectorMasterKeyBackup` / `verifyConnectorMasterKeyRestore`
(`apps/api/src/security/connector-master-key-backup.ts`).

## restore verify (não altera o ambiente ativo)
1. lê o artefato cifrado; valida `formatVersion`;
2. valida `checksum` (SHA-256 do ciphertext);
3. autentica o ciphertext (auth tag) e decifra com a wrapping key **em isolamento**;
4. valida o keyring restaurado (invariantes de `buildConnectorMasterKeyring`);
5. confere as versões esperadas presentes;
6. **descarta o plaintext**; retorna relatório **sanitizado** (`status: PASS|FAIL`, sem
   material de chave).

## Fail-closed (comprovado por teste)
Wrapping key errada → FAIL; artefato/checksum adulterado → FAIL; auth tag adulterada → FAIL;
keyring inválido → FAIL. Nunca altera o ambiente ativo; nunca vaza plaintext.

## Production restore
**NOT CLAIMED** — não há infraestrutura de produção real nesta fase. O restore verify e o
drill rodam offline em ambiente controlado. Ver `CONNECTOR_MASTER_KEY_DR_DRILL.md`.
