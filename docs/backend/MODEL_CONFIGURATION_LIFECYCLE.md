# Ciclo de vida de configuração de modelo (ARDEN-BE-007.2)

Tenant-scoped. `DRAFT → ACTIVE → SUSPENDED ↔ ACTIVE`, qualquer estado `→ REVOKED`
(terminal). Criação valida provider existente e ACTIVE; `credentialConnectionId` (quando
presente) deve pertencer ao mesmo tenant. **Ativação** exige provider ACTIVE e, em
`NODE_ENV=production`, `productionAllowed=true` (o provider de teste é bloqueado →
`MODEL_PROVIDER_DISABLED`). PATCH edita nome/descrição/modelId/credencial/parâmetros com
`revision` — nunca status (comando dedicado). Nenhum segredo é persistido nem retornado; a
resposta expõe apenas `providerKey`/`providerVersion` (nunca `providerDefinitionId`),
`modelId`, parâmetros, status, revisão e `credentialConnectionId` (referência ao cofre).
Publicar uma versão que aponta para uma configuração inativa falha (`MODEL_CONFIGURATION_NOT_ACTIVE`).
