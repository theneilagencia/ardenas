# Resolução de tool binding — ARDEN-BE-006.6

> `ToolBindingResolver.resolveForExecution({ organizationId, operationId,
> operationVersionId, alias, actionKey })` → `ResolvedToolBinding` (somente dados
> seguros). `ConnectionResolver.resolveActiveConnection(...)` valida a conexão ativa.
> Toda leitura é tenant-scoped (`findFirst` por `organizationId`).

## Regras (todas obrigatórias)

1. operação pertence ao tenant;
2. versão pertence à operação;
3. versão está publicada;
4. operation binding pertence ao tenant;
5. binding habilitado;
6. binding não removido (`removedAt = null`);
7. alias confere;
8. actionKey solicitada ∈ `allowedActionKeys`;
9. organization binding pertence ao tenant;
10. organization binding habilitado;
11. connection pertence ao tenant;
12. connection ACTIVE (REVOKED/SUSPENDED bloqueiam);
13. connector definition ACTIVE;
14. tool definition ativa;
15. tool pertence ao conector da conexão;
16. tool.actionKey confere;
17. `internal.test` (productionAllowed=false) bloqueado quando `NODE_ENV=production`;
18. nenhuma informação sensível é retornada.

## `ResolvedToolBinding` (seguro)

`operationToolBindingId`, `organizationToolBindingId`, `connectionId`,
`connectorKey/Version`, `toolKey/Version`, `actionKey`, `configuration` (não
sensível), `policy` (SecureHttpPolicy efetiva), `inputMapping`, `outputMapping`,
`idempotencyMode`, `retryMode`, `defaultTimeoutMs`, `maximumTimeoutMs`,
`inputSchema`, `outputSchema`, `credentialSchema`, `credentialFingerprint?`.
**Nunca inclui `secret`.**

## Auditoria

`tool_binding.resolved` (SUCCESS) / `tool_binding.resolution_denied` (DENIED, com
`reason = <código do erro>`). Erros são tipados e sanitizados
(`TOOL_BINDING_NOT_FOUND`, `TOOL_EXECUTION_DENIED`, `TOOL_NOT_AVAILABLE`,
`CONNECTION_*`).
