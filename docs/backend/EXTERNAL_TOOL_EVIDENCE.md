# Evidência de ferramenta externa — ARDEN-BE-006.6

> Evidência append-only e **sanitizada** por tentativa de chamada externa. Registra o
> suficiente para auditoria/reprodução SEM jamais expor segredo.

## Campos registrados

`connectorKey/version`, `toolKey/version`, `operationToolBindingId`,
`organizationToolBindingId`, `connectionId`, `fingerprint` (da credencial usada —
`sha256:<8hex>`), `actionKey`, `method`, `host` (sanitizado), `path` (sanitizado),
`requestHash`, `responseHash`, `httpStatus`, `status`, `resultClassification`,
`retryable`, `errorCode`, `bytes`, `attempt`, `durationMs`.

## Nunca registrado

`secret`, `Authorization`, cookies, request completo, response completo, ciphertext,
`nonce`, `authTag`, query sensível. O `ExecutionRecorder.recordEvidence` aplica
`sanitizeContent` (redige `authorization|token|secret|password|cookie|bearer`) e grava
`contentHash` do conteúdo já sanitizado; o executor já entrega apenas hashes e
metadados. Headers de resposta são redigidos por `redactHeaders`.

## Auditoria

`external_tool.execution_started`, `external_tool.execution_succeeded`,
`external_tool.execution_failed`, `external_tool.execution_unknown` (reutilizando
`audit_events`, com metadata sanitizada). Resolução de binding e credencial emitem
`tool_binding.resolved|resolution_denied` e `credential.resolved|resolution_denied`.
