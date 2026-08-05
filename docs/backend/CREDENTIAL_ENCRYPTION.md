# Criptografia de credenciais — ARDEN-BE-006.4

- **Algoritmo:** AES-256-GCM (`node:crypto`, sem crypto artesanal).
- **Chave:** 256 bits (32 bytes).
- **Nonce:** 96 bits aleatório, **novo a cada operação** (nunca reutilizado).
- **Auth tag:** 128 bits; `decipher.final()` lança em tag inválida → **falha fechada**.
- **AAD determinística:** `organizationId <TAB> connectionId <TAB> credentialVersionId
  <TAB> keyVersion`. Qualquer troca (tenant, conexão, versão, keyVersion) → falha de
  integridade (testado). Defende contra troca de ciphertext entre tenants/recursos.
- **Serialização:** só objeto JSON simples; rejeita função, protótipo inesperado,
  circular e tamanho > 16 KB; validação limitada contra o `credentialSchema` do
  conector (required + additionalProperties=false) antes de cifrar.
- **Ciphertext/nonce/authTag** persistidos em Base64. `encryptedDataKey = null`
  (provider sem DEK separada — documentado; envelope com DEK é evolução futura).
- **Fingerprint:** `sha256:<8 hex>` do segredo canônico. Não reconstrói o segredo;
  não é autenticação; só prefixo seguro exposto na API.

Proibições: reuso de nonce, AES-CBC/ECB, XOR, crypto artesanal, omitir autenticação.
