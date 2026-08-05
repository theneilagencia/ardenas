# Rotação de credencial Anthropic (ARDEN-BE-008.2)

> Reusa a rotação de `credential-versions` do BE-006. Idempotente, transacional, com
> um único vencedor sob concorrência. **Nunca retorna a key.**

## 1. Endpoint

```
POST /organizations/{orgId}/connections/{id}/credentials/rotate
```

- Permissão: `connection.rotate_credentials`.
- Idempotente (`Idempotency-Key`).
- **Pré-condição: a conexão deve estar `ACTIVE`.**

## 2. Fluxo (mesma transação)

1. cria nova versão `PENDING`;
2. `vault.storeSecret` cifra a nova key (AES-256-GCM) na mesma transação;
3. faz `supersede` da versão `ACTIVE` anterior (→ `SUPERSEDED`);
4. ativa a nova versão (→ `ACTIVE`);
5. repõe `connection.currentCredentialVersionId` para a nova versão.

O histórico anterior é preservado (auditoria e versões antigas permanecem).

## 3. Concorrência

Rotações concorrentes disputam o **índice único de versão ativa**: apenas uma vence;
a perdedora falha com `credentialRotationConflict`. Não há duas versões `ACTIVE`.

## 4. Revogação

```
POST /organizations/{orgId}/connections/{id}/credentials/{versionId}/revoke
```

- **Crypto-shredding**: anula o material criptográfico; preserva os metadados
  (id, versão, fingerprint, datas, status `REVOKED`).
- Uma credencial **revogada ou ausente bloqueia ativação futura**. Não há fallback
  para credencial antiga nem para env var.

## 5. NUNCA

- retornar a key em qualquer etapa (rotação ou revogação);
- resolver uma versão `SUPERSEDED`/`REVOKED` como ativa;
- cair em credencial antiga ou variável de ambiente quando a ativa está ausente.
