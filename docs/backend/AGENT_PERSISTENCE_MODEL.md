# Modelo de persistência de agentes (ARDEN-BE-007.2)

Quatro entidades espelham os contratos do 007.1 e os padrões factuais do BE-006
(`OrganizationConnection`/`OperationVersion`). Políticas e prompts são **colunas JSON na
versão** (menor complexidade sem perder versionamento, imutabilidade, validação,
auditoria e diff futuro) — não há tabela por subpolítica.

## Tabelas

- **`model_provider_definitions`** (system-managed, sem tenant): `key`,`version` único;
  `status` (ACTIVE/DEPRECATED/DISABLED); `capabilities` JSON; `productionAllowed`;
  `systemManaged`; `catalogHash`. Nunca credencial/SDK/segredo. CRUD tenant não altera.
- **`model_configurations`** (tenant): `providerDefinitionId` (FK RESTRICT); `modelId`;
  `credentialConnectionId?` (referência ao cofre, nunca o segredo); `parameters` JSON;
  `status`; `revision`.
- **`agent_definitions`** (tenant): `(organizationId, key)` único; `status`;
  `currentPublishedVersionId?` (validado no service); `revision`. Sem prompt/modelId/provider.
- **`agent_versions`** (tenant): `(agentDefinitionId, versionNumber)` único; `objective`,
  `systemInstructions`, `modelConfigurationId` (FK RESTRICT), `inputSchema`, `outputSchema`,
  cinco políticas (JSON), `contentHash`, `publishedAt?`, `retiredAt?`, `revision`.

## Regras

Sem delete físico (revogação/retirada são lógicas). FKs `ON DELETE RESTRICT` preservam
histórico. Ponteiros cross-entidade sem semântica (ex.: `currentPublishedVersionId`,
`credentialConnectionId`) são UUID simples validados transacionalmente no service (padrão
factual do BE-006), com teste de integração cobrindo o isolamento de tenant.
