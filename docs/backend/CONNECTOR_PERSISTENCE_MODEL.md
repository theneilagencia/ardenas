# Modelo de persistência de conectores — ARDEN-BE-006.3

> Camada de persistência do domínio de conectores. **Sem** cofre, criptografia
> funcional, SecureHttpClient, SSRF runtime, worker externo ou webhook público
> funcional (fases 006.4+). Fonte dos contratos: `src/contracts/connectors/`.

## Tabelas (migração `20260802001518_connectors_persistence`)

| Tabela | Tenant | Papel | Segredo? |
|---|---|---|---|
| `connector_definitions` | sistema | catálogo de conectores (system-managed) | não |
| `connector_tool_definitions` | sistema | catálogo de ferramentas | não |
| `organization_connections` | org | conexão da org com um sistema externo | não (config não sensível) |
| `connection_credential_versions` | org | versões de credencial (cripto NULL nesta fase) | **estrutura**; nada persistido |
| `organization_tool_bindings` | org | org → ferramenta sobre conexão | não |
| `operation_tool_bindings` | org | ferramenta → operação/versão (alias) | não |
| `webhook_endpoints` | org | endpoint de entrada (token só hash) | não |
| `webhook_deliveries` | org | entregas recebidas (append-oriented) | não |

`organizationId` é escalar (padrão `AuditEvent`), com FK a `organizations` na migração
SQL. Sem cascade destrutivo: FKs `RESTRICT`; ponteiros de credencial `SET NULL`.

## Credenciais NÃO guardam segredo nesta fase

`connection_credential_versions` tem os campos criptográficos finais
(`encrypted_secret`, `encrypted_data_key`, `algorithm`, `key_version`, `nonce`,
`auth_tag`, `fingerprint`) — **todos NULL** até o cofre (006.4). O status inicial é
`PENDING`. Nenhum service aceita plaintext; não há endpoint funcional de criação de
credencial com segredo. Fixtures usam `encryptedSecret=null` + `status=PENDING`.

O serializador `toCredentialMetadataContract` é o **limite de segurança**: emite só
metadados (`status`, `fingerprint`, `keyVersion`, `versionNumber`, datas) e **nunca**
os campos criptográficos, mesmo que a linha os possua.

## Correção contratual (PENDING)

O contrato de 006.2 tinha `credentialStatus = ACTIVE|SUPERSEDED|REVOKED`. A
persistência exige um estado antes da ativação pelo cofre, então adicionou-se
`PENDING` ao enum do contrato (`src/contracts/connectors/connector-keys.ts`) e ao
Prisma. OpenAPI e cliente foram regenerados. É a **menor** correção contratual
necessária, documentada aqui (§2 do enunciado).

## Índices e constraints

- Uniques: `connector_definitions(key,version)`,
  `connector_tool_definitions(connector_definition_id,key,version)`,
  `connection_credential_versions(connection_id,version_number)`,
  `webhook_endpoints(path_token_hash)`.
- **Índice parcial único** `uniq_active_credential_per_connection`
  `(connection_id) WHERE status='ACTIVE'` → no máximo UMA credencial ativa por conexão.
- **Índice parcial único** `uniq_webhook_delivery_per_external_id`
  `(webhook_endpoint_id, external_delivery_id) WHERE external_delivery_id IS NOT NULL`
  → deduplicação por delivery id.
- Índices tenant-scoped conforme §6 do enunciado (status, updated_at, connection_id,
  action_key, alias, received_at, payload_hash, etc.).

## Remoção lógica

`operation_tool_bindings` nunca sofre delete físico. A remoção é lógica
(`removed_at` + `removed_by_user_id` + `enabled=false`), preservando o histórico
para futuras execuções (§18).

## Auditoria e idempotência

Reutilizam a infra existente: `audit_events` (`AuditRecorder.record(tx, …)`) e
`idempotency_records` (`runIdempotentCommand`). **Nenhuma** segunda infraestrutura foi
criada. A projeção do catálogo é uma operação de **sistema** (não tenant): registrada
por log estruturado + resultado, não no `audit_events` tenant-scoped.
