# Armazenamento da credencial Anthropic (ARDEN-BE-008.2)

> API key é **tenant-managed** e guardada **apenas** no `SecretVault` (BE-006.4) como
> uma `ConnectionCredentialVersion`. Sem cofre paralelo, sem tabela de segredo
> específica da Anthropic, sem env var como credencial de tenant.

## 1. Input write-only, resposta só metadados

**Input** (create/rotate):

```
{ apiKey: string }   // write-only; entra e nunca sai
```

**Resposta** (metadados apenas):

```
{ id, versionNumber, status, fingerprint, keyVersion, createdAt, ... }
```

A resposta **nunca** contém o segredo. `fingerprint` é uma identificação **não
reversível** da versão — não permite reconstruir a key.

## 2. Criptografia (BE-006.4)

| Item | Valor |
| --- | --- |
| Algoritmo | AES-256-GCM |
| Nonce | 96 bits, aleatório por operação |
| Auth tag | 128 bits |
| AAD | `organizationId \t connectionId \t credentialVersionId \t keyVersion` |
| `keyVersion` | vinda de config (`CONNECTOR_MASTER_KEY` / `CONNECTOR_KEYRING_JSON`) |

O AAD amarra o ciphertext ao tenant/conexão/versão: material de uma org não decifra
em outra. O plaintext é **descartado após a cifragem** e **nunca persistido**.

## 3. Status da credencial

```
PENDING → ACTIVE → SUPERSEDED → REVOKED
```

**Única versão `ACTIVE`** por conexão, garantido por um **índice parcial único**. A
resolução server-side usa somente a versão `ACTIVE`.

## 4. Onde a key vive — e onde NUNCA

Vive: `connection_credential_versions` (cifrada no vault). Ponto.

NUNCA aparece em:

- resposta de API, frontend ou cliente gerado;
- logs (estruturados ou métricas), stdout/stderr;
- trilha de auditoria ou evidência de execução;
- `ModelConfiguration.parameters` (é credencial, não parâmetro);
- payload de idempotência;
- cofre paralelo ou tabela específica da Anthropic.
