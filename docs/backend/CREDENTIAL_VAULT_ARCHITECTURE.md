# Arquitetura do cofre de credenciais — ARDEN-BE-006.4

O domínio depende da interface **`SecretVault`** (`apps/api/src/connectors/vault/secret-vault.ts`),
nunca de um provider concreto. O provider é selecionado por configuração no bootstrap:
`app-aes-gcm` (funcional) ou `fake` (testes). **Sem fallback silencioso**; `fake` é
proibido em production (o factory lança).

## Componentes
- `SecretVault` — `storeSecret` / `resolveSecret` / `rotateSecret` / `revokeSecret`.
  Retorna plaintext SOMENTE em memória ao chamador autorizado; nunca expõe material
  criptográfico ao domínio.
- `AppAesGcmVault` — cifra AES-256-GCM, persiste APENAS o ciphertext + metadados
  criptográficos na versão de credencial (tenant-scoped). Aceita a transação do
  serviço (`CredentialVaultDb`) → criação/rotação atômicas.
- `ConnectorKeyProvider` — master key + keyring da CONFIG (nunca do banco). Cifra com
  a chave corrente; decifra com a versão registrada.
- `CredentialResolver` — resolução **server-side** com validação de tenant/estado;
  única porta de saída do plaintext (para serviços internos). **Não há endpoint
  público de resolução.**

## Fluxo
`recebida → validada → cifrada (AAD) → persistida (ciphertext) → ativada (atômica) →
resolvida só no servidor → rotacionada → revogada (crypto-shredding)`.

## Idempotência segura
`runIdempotentCommand` é reutilizado. A tabela `idempotency_records` guarda apenas o
**hash** do request (sha256) e a **resposta** (metadados, sem segredo) — nunca o body
bruto. Verificado por teste canário.

## Nada de segredo em: resposta, log, auditoria, evidência, job, idempotência.
