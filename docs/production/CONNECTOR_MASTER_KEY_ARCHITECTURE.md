<!-- Milestone: ARDEN-PRD-001.1B -->
# ARDEN-PRD-001.1B — Arquitetura da connector master key

## Modelo criptográfico (preservado de BE-006.4)
AES-256-GCM (`connectors/vault/aes-gcm.ts`): nonce de 96 bits único por operação, auth tag
de 128 bits, AAD determinística (`org\tconn\tcredVersion\tkeyVersion`), falha FECHADA em
auth tag inválida. **Não reescrito** — o formato de ciphertext e o `keyVersion` gravado por
credencial são mantidos.

## Keyring versionado (`security/connector-master-keyring.ts`)
```
ConnectorMasterKey  { version, key: Buffer(32), status: PRIMARY | DECRYPT_ONLY }
ConnectorMasterKeyring { primary, decryptKeys[] }
```
Invariantes validadas em `buildConnectorMasterKeyring`:
- exatamente **uma** PRIMARY (cifra + decifra);
- versões anteriores são **DECRYPT_ONLY**;
- versões únicas; material de **32 bytes** (Base64 válido); vazio/encoding inválido falha;
- `resolveKeyForVersion` falha FECHADA (`MASTER_KEY_VERSION_UNAVAILABLE`) em versão desconhecida;
- **nenhuma chave é persistida no banco** — o keyring vem só da config/PlatformSecretSource.

## Fonte de configuração
Reutiliza `CONNECTOR_KEY_VERSION` (primária) + `CONNECTOR_MASTER_KEY` (material da primária)
+ `CONNECTOR_KEYRING_JSON` (versões antigas), já validados em `config/env.schema.ts` (32
bytes; fixture de teste recusada em produção — `WELL_KNOWN_TEST_MASTER_KEYS`).

## Preflight criptográfico (`preflightKeyring`)
Antes de aceitar tráfego/worker: carrega o keyring, valida invariantes, coleta as
`referencedCiphertextVersions` (versões efetivamente usadas por credenciais no banco) e
reporta `missingVersions`. Resultado **sanitizado** (`primaryKeyVersion`,
`availableDecryptVersions`, `referencedCiphertextVersions`, `missingVersions`, `status`) —
nunca contém material de chave. `status: MISSING_VERSIONS` deve levar o chamador a falhar
fechado (readiness=false).

> **Integração de readiness (API/worker):** o resultado do preflight deve alimentar o
> `/ready` e o readiness do worker. Esta integração de wiring está **STILL_OPEN** nesta
> fase (o núcleo puro + testes está entregue); ver `ARDEN_PRD_001_1_RESIDUAL_RISKS.md`.

## Fail-closed
Chave primária ausente, tamanho/encoding inválido, versão duplicada, versão desconhecida,
decrypt/auth-tag/AAD inválida → erro seguro. **Nunca** tenta outra chave indiscriminadamente,
ignora auth failure, retorna plaintext parcial ou trata secret como vazio.
