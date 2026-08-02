# Ciclo de vida da credencial — ARDEN-BE-006.4

Estados: `PENDING → ACTIVE → SUPERSEDED → REVOKED` (nunca volta a ACTIVE).

## Criar (com segredo) — atômico
Numa única transação: valida tenant/conexão/conector/schema → cria versão PENDING →
**cifra** (SecretVault, na mesma tx) → supersede a ACTIVE anterior (se houver) →
ativa a nova → atualiza `currentCredentialVersionId` → auditoria. Rollback TOTAL em
qualquer falha (nada persiste). Não deixa credencial válida em PENDING após sucesso.

## Rotacionar — atômico
Exige conexão ACTIVE. Mesmo fluxo da criação para uma nova versão; a anterior vira
SUPERSEDED e o ponteiro passa à nova. Concorrência garantida pelo índice parcial
único (uma ACTIVE por conexão) + unicidade `(connection, versionNumber)`: rotações
concorrentes → apenas uma ACTIVE; a perdedora recebe `CREDENTIAL_ROTATION_CONFLICT`.

## Revogar
`PENDING/ACTIVE/SUPERSEDED → REVOKED`. Ao revogar a ativa, limpa o ponteiro. Faz
**crypto-shredding** (zera ciphertext/nonce/authTag via cofre) — a versão revogada é
irrecuperável; metadados/fingerprint/histórico preservados. Não reativa.

## Resolver (server-side)
`CredentialResolver.resolveActiveCredential` valida tenant + conexão (ACTIVE, não
suspensa/revogada) + credencial ACTIVE, então decifra. Plaintext só em memória. Não
há endpoint público de resolução.
