# ARDEN-BE-006.3 — Relatório de implementação (persistência)

Camada de persistência do domínio de conectores: modelos Prisma, migração real,
projeção do catálogo, repositories tenant-scoped, máquinas de estado, application
services, auditoria/idempotência reutilizadas e testes com PostgreSQL real.

## Entregue

- **Migração** `20260802001518_connectors_persistence` (8 tabelas + 11 enums +
  índices + uniques + índices parciais únicos + FKs sem cascade destrutivo).
- **Correção contratual mínima**: `credentialStatus` ganhou `PENDING` (contrato +
  Prisma), OpenAPI e cliente regenerados. Documentada em
  `CONNECTOR_PERSISTENCE_MODEL.md`.
- **Projeção do catálogo**: função pura `runCatalogProjection` (seed + projector Nest),
  hash determinístico, idempotente (create/update/unchanged/deprecate/disable).
- **Repositories tenant-scoped** (leitura por `id + organizationId`): conexões,
  credenciais, org/operation bindings, webhook endpoints/deliveries; catálogo (leitura,
  system-managed).
- **Máquinas de estado** puras (conexão, credencial, webhook endpoint/delivery).
- **Application services** (sem HTTP): `ConnectionsService`, `CredentialVersionsService`
  (lifecycle SEM segredo), `ToolBindingsService` (org + operation, remoção lógica),
  `WebhooksService` (endpoint token-hash + delivery dedup).
- **Serializador de credencial** como limite de segurança (só metadados).
- **Seed** projeta o catálogo após as permissões (idempotente 2×).
- **Módulo** `ConnectorsModule` registrado no `AppModule` (worker herda).

## Guardrails cumpridos

- Nenhum plaintext persistido; campos criptográficos NULL; status `PENDING`.
- Nenhum service aceita segredo; nenhum endpoint funcional de credencial.
- Nenhum DTO/mapper público expõe `encryptedSecret/encryptedDataKey/nonce/authTag`.
- Uma única credencial `ACTIVE` por conexão (índice parcial único).
- Conexão/webhook `REVOKED` não reativa.
- Remoção lógica de operation binding (sem delete físico).
- Reuso de `audit_events` e `idempotency_records` (sem segunda infra).
- Cross-tenant bloqueado; `revision` compare-and-set.
- **Não** implementados: cofre, criptografia, SecureHttpClient, SSRF runtime, worker
  externo, webhook público funcional, frontend.

## Fora de escopo (fases seguintes)

Cofre/AES-256-GCM/rotação funcional/startup validation/canário (006.4); Secure HTTP +
SSRF (006.5); executor externo + worker (006.6); webhooks funcionais (006.7); frontend
(006.8).
