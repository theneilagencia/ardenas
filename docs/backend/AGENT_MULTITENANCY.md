# Multitenancy do runtime de agentes (ARDEN-BE-007.2)

IDs conhecidos NÃO concedem acesso. Toda leitura tenant-scoped usa
`findFirst({ where: { id, organizationId } })` — nunca `findUnique` por id. Repositórios de
`ModelConfiguration`, `AgentDefinition` e `AgentVersion` seguem esse padrão; `updateMany`/
`transitionGuarded` incluem `organizationId` no `where`.

Regras cross-tenant validadas transacionalmente (não por FK simples) e cobertas por teste
de integração (`agents-critical.integration.spec.ts §34`):
- Alpha não lê nem edita agente/versão/config de Beta → **404** (anti-enumeração);
- `AgentVersion` só referencia `ModelConfiguration` do mesmo tenant (senão 404);
- `credentialConnectionId` deve pertencer ao tenant;
- `currentPublishedVersionId` pertence ao mesmo agente/tenant;
- auditoria nunca mistura tenants (`organizationId` em cada evento).

O `organizationId` vem sempre da sessão validada (OrganizationGuard), nunca do corpo da
requisição.
