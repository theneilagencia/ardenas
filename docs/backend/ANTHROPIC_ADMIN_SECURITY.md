# Postura de segurança administrativa Anthropic (ARDEN-BE-008.2)

> Consolidação da postura de segurança da integração administrativa, NÃO executável.
> Nenhuma chamada real de API; nenhum segredo real em teste (apenas canário).

## 1. Segredo (API key)

- **write-only**: entra por create/rotate e nunca sai;
- vive **apenas** no `SecretVault`, cifrado AES-256-GCM (ver
  `ANTHROPIC_CREDENTIAL_STORAGE.md`);
- **nunca** em: resposta, logs, auditoria, evidência, payload de idempotência,
  config da conexão, `ModelConfiguration`, exemplos OpenAPI, cliente gerado, erros,
  stdout/stderr.

## 2. Base URL travada

`baseUrlMode = 'OFFICIAL'` (enum de valor único). Sem override de `baseUrl`, `proxyUrl`,
`customHost`, `customHeaders`, `Authorization`, `anthropic-version` ou `anthropic-beta`.

## 3. Isolamento de tenant

Repositórios filtram por `organizationId`. Acesso cross-tenant → **404 sem vazar
existência** do recurso de outra org.

## 4. Concorrência e idempotência

- **`revision`**: concorrência otimista; conflito → `VERSION_CONFLICT`;
- **idempotência**: o **segredo não faz parte** do material da chave de idempotência
  (corpo hasheado sem o plaintext).

## 5. Eventos de auditoria

Projeção/catálogo: `anthropic.connector_projected`, `anthropic.provider_projected`,
`anthropic.model_catalog_projected`.

Conexão: `connection.created`, `connection.updated`,
`connection.configuration_validated`, `connection.suspended`, `connection.revoked`.

Credencial: `credential.version_created`, `credential.rotated`, `credential.revoked`.

Config de modelo: `model_configuration.created`, `model_configuration` activation
blocked. Nenhum evento carrega o segredo.

## 6. Provider não executável

- sem dependência de SDK; sem `messages.create`; sem fetch a `api.anthropic.com`;
- provider `DISABLED`, **não registrado** no registry de runtime;
- **nenhuma chamada real de API**; **nenhum segredo real** usado em testes (canário só).
