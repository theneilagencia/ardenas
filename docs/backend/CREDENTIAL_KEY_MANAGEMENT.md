# Gestão de chaves — ARDEN-BE-006.4

- **`CONNECTOR_MASTER_KEY`** (Base64 = 32 bytes). NUNCA no banco, NUNCA versionada,
  sem default. Obrigatória em production; strings curtas/malformadas rejeitadas no
  **startup**.
- **`CONNECTOR_KEY_VERSION`** — versão da chave corrente, persistida em cada versão de
  credencial (`keyVersion`).
- **`CONNECTOR_KEYRING_JSON`** (opcional) — `{ "<version>": "<base64-32>" }` para
  decifrar versões antigas após rotação de master key.

`ConnectorKeyProvider`:
- `getCurrentKey()` → chave corrente (falha se indisponível).
- `getKey(version)` → chave por versão; **falha** se a versão antiga não estiver no
  keyring. Nunca imprime material de chave.

## Rotação de master key (futuro)
Novas versões cifram com a chave corrente; versões antigas continuam decifráveis
enquanto a chave estiver no keyring. A **re-encryption** de toda a base (reescrever
ciphertext com a nova chave) NÃO é feita nesta fase — é um job futuro. Enquanto isso,
manter as chaves antigas no keyring garante resolução.
