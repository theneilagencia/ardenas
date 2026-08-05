# ARDEN-BE-006.4 — Evidência de testes (cofre)

## Unit (`npm run test:api`) — +34 testes
- `aes-gcm.spec.ts` (10): roundtrip; nonce único; mesmo plaintext → ciphertext
  diferente; auth tag inválida; ciphertext alterado; chave errada; AAD alterada
  (org/conn/cred/keyVersion) → falha; chave de tamanho inválido.
- `secret-serialization.spec.ts` (8): objeto válido/ inválido; função; tamanho;
  credentialSchema required/additionalProperties; fingerprint determinístico e sem
  plaintext; canonicalização.
- `vault-config.spec.ts` (11): startup (prod sem key / fake / key curta / provider
  desconhecido / válido / fake em test / keyring inválido); ConnectorKeyProvider.
- `sensitive-data-redactor.spec.ts` (5): redactObject recursiva/arrays/case-insensitive/
  sem mutar/circular; headers; error; url.

## Integração (`npm run test:api:integration`) — +12 testes
`credential-vault.integration.spec.ts` (7): cria cifrada (response sem segredo,
ciphertext persistido sem plaintext, ponteiro), resolução server-side, list de
metadados, rotação (v2 ativa/v1 superseded), revogação (crypto-shredding + resolução
falha), idempotência (replay sem nova versão), auditoria/idempotência sem segredo.

`credential-vault-critical.integration.spec.ts` (5 CRÍTICOS):
1. **Canário**: valor único não aparece em resposta/banco (nem no ciphertext)/auditoria/
   idempotência; resolução interna funciona.
2. **Troca de ciphertext**: material de Alpha injetado em Beta → decifra falha
   (`CREDENTIAL_RESOLUTION_FAILED`), sanitizado (AAD).
3. **Rotação concorrente**: uma única versão ACTIVE.
4. **Rollback**: falha antes do ponteiro → v1 continua ACTIVE, v2 não persiste, sem
   auditoria de sucesso.
5. **Cross-tenant**: Beta não cria/resolve credencial de conexão de Alpha (404).

## Gates
typecheck/lint/test/test:a11y/build/contracts:openapi + typecheck:api/lint:api/test:api/
test:api:integration/build:api + db:migrate:deploy/status + db:seed×2 — verdes. OpenAPI
sincronizada. Nenhuma migration corretiva necessária (colunas já existiam do 006.3).
