# Resolução do runtime de agente (ARDEN-BE-007.3 §6/§7)

`AgentRuntimeResolver.resolveForExecution` valida, tenant-scoped, antes de qualquer chamada
de modelo, e monta um `ResolvedAgentRuntime` SEM segredo/credencial/SDK/provider client.

Valida: operação do tenant; versão de operação publicada; AgentDefinition do tenant e
ACTIVE (REVOKED/SUSPENDED negam); AgentVersion do agente, do tenant e PUBLISHED; contentHash
presente; ModelConfiguration do tenant e ACTIVE; provider existe, ACTIVE e permitido no
ambiente (`internal.test-model` proibido em produção → `MODEL_PROVIDER_DISABLED`); políticas
e schemas válidos (parse contra os contratos). Toda busca é `findFirst {id, organizationId}`
— IDs conhecidos não concedem acesso. Falha de resolução vira resultado tipado do agente
(evento `agent.execution_failed`), sem contexto montado.
