# Ciclo de vida da conexão Anthropic (ARDEN-BE-008.2)

> `OrganizationConnection` (tenant-scoped) reusa a máquina de estados de conexão do
> BE-006. Nenhum status novo foi inventado. **Não há validação de rede real** com a
> Anthropic nesta fase (ver `ANTHROPIC_CONFIGURATION_VALIDATION.md`).

## 1. Máquina de estados (BE-006, `ConnectionStatus`)

```
DRAFT     → [ACTIVE, REVOKED]
ACTIVE    → [SUSPENDED, ERROR, REVOKED]
SUSPENDED → [ACTIVE, REVOKED]
ERROR     → [ACTIVE, SUSPENDED, REVOKED]
REVOKED   → (terminal)
```

## 2. Estratégia adotada para 008.2

- A conexão é **criada como `DRAFT`**.
- Pode ser **ATIVADA** (ação de ciclo de vida do tenant). A ativação é **independente
  do provider estar `DISABLED`**: ativar a conexão apenas habilita operações de
  credencial (ex.: rotação) — **não** faz o provider executar modelo.
- Estar `ACTIVE` é pré-requisito para rotação de credencial (ver
  `ANTHROPIC_CREDENTIAL_ROTATION.md`), não para execução.

Não se confunda ativação de conexão (tenant) com habilitação de provider (catálogo):
são planos separados. A conexão pode estar `ACTIVE` com o provider ainda `DISABLED`.

## 3. Concorrência e idempotência

- **`revision`**: concorrência otimista. Conflito → `VERSION_CONFLICT` (HTTP 409).
- **`Idempotency-Key`**: exigida no create para deduplicar criação repetida.

## 4. Endpoints

```
POST   /organizations/{orgId}/connections            # cria (DRAFT)
GET    /organizations/{orgId}/connections[/{id}]     # lista / detalha
PATCH  /organizations/{orgId}/connections/{id}       # atualiza config (revision)
POST   /organizations/{orgId}/connections/{id}/activate
POST   /organizations/{orgId}/connections/{id}/suspend
POST   /organizations/{orgId}/connections/{id}/reactivate
POST   /organizations/{orgId}/connections/{id}/revoke
```

Todos tenant-scoped por `orgId`; acesso cross-tenant → 404 (sem vazar existência).

## 5. NUNCA

- inventar um status fora da máquina do BE-006;
- fazer chamada de rede à Anthropic durante `activate`/`reactivate`;
- tratar `activate` como "conexão verificada pela Anthropic".
