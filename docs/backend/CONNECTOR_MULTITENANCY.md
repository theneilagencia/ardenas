# Multitenancy de conectores — ARDEN-BE-006.3

## Regra
Todo recurso tenant-scoped (conexões, credenciais, bindings, webhooks, entregas) é
lido/escrito **sempre** com `organizationId`. Os repositories usam
`findFirst({ where: { id, organizationId } })` — **nunca** `findUnique({ where: { id } })`
como consulta final para recurso tenant-scoped. O `organizationId` vem do contexto
autenticado, nunca do body.

## Cross-tenant bloqueado (comprovado)
`connectors-critical.integration.spec.ts`:
- Alpha não lê conexão de Beta (`RESOURCE_NOT_FOUND`).
- Alpha não cria binding com conexão de Beta.
- Credencial de Beta não vira current de Alpha.
- Operação de Alpha não referencia org binding de Beta (`TOOL_BINDING_NOT_FOUND`).
- Webhook de Alpha não referencia conexão de Beta.
- Auditoria não mistura tenants.

## Integridade estrutural
FKs de `organization_id → organizations` (RESTRICT). O catálogo (system-managed) não
é tenant-scoped. Índices parciais únicos (credencial ACTIVE, delivery id) operam por
conexão/endpoint, que já são tenant-scoped por FK.
