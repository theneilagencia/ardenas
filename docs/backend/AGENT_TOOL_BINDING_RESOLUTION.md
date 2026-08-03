# Agent tool binding resolution (ARDEN-BE-007.5)

`AgentToolBindingResolver` reutiliza o `ToolBindingResolver` do BE-006. As ferramentas
expostas ao modelo são a INTERSEÇÃO: `AgentVersion.toolPolicy.allowedAliases` ∩ bindings de
operação habilitados ∩ bindings de organização habilitados ∩ conexão ACTIVE ∩ connector
ACTIVE (produção) ∩ `ConnectorToolDefinition` ativa. O risco vem da `ConnectorToolDefinition`.
Alias conhecido não concede acesso — toda consulta é tenant-scoped por `organizationId`. O
modelo só vê `{alias, description, inputSchema, riskLevel}`; nunca connectionId/credential/
URL/headers/actionKey/executor.
