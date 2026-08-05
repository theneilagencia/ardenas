<!-- Milestone: ARDEN-PRD-001.1C -->
# ARDEN-PRD-001.1C — Backup da connector master-key keyring

Implementado em `apps/api/src/security/connector-master-key-backup.ts`.

## Artefato (`ConnectorMasterKeyBackupArtifact`)
- `manifest`: formatVersion, createdAt, environment, primaryKeyVersion, includedKeyVersions,
  `encryptionMethod: AES-256-GCM`, `checksum` (SHA-256 hex do ciphertext), metadata.
- `envelope`: payload CIFRADO (keyring serializada version→Base64), com nonce + auth tag.

## Propriedades (comprovadas por teste)
- **Cifrado + autenticado** (AES-256-GCM, AAD vinculando formato+ambiente+primária).
- **Sem plaintext** de chave; **sem a wrapping key**; **sem secrets de tenants**; **sem
  credenciais de banco** no artefato (canário: dump não contém material de K1/K2/WRAP).
- **Wrapping key SEPARADA** da master key, vinda do `PlatformSecretSource`
  (`CONNECTOR_MASTER_KEY_BACKUP_WRAPPING_KEY`) — **nunca derivada da master key, nunca fixa
  em código**.
- Checksum + auth tag detectam adulteração (fail-closed).

## Regra de armazenamento
A wrapping key **não** é armazenada junto ao backup. O backup vai para o secret manager /
storage cifrado; a wrapping key vive no `PlatformSecretSource` (namespace de ambiente).
Runbook: `docs/runbooks/CONNECTOR_MASTER_KEY_RECOVERY.md`.
