# Execução de ferramenta externa — ARDEN-BE-006.6

> Integra os conectores ao motor real de execução (BE-005). Uma etapa publicada
> referencia uma ferramenta por **alias**; o worker resolve o vínculo tenant-scoped,
> resolve a credencial no servidor, chama via `SecureHttpClient` e registra evidência
> e auditoria sanitizadas. NÃO há endpoint de execução direta de ferramenta.

## 1. Fluxo

```
ExecutionWorker → ExecutionProcessor → StepExecutorRegistry
  → ExternalToolStepExecutor → ExternalToolExecutor
    → ToolBindingResolver → ConnectionResolver → CredentialResolver
    → SecureHttpClient → ExternalToolResult
  → ExecutionRecorder (evidência) + AuditRecorder (external_tool.*)
```

- O `StepExecutorRegistry` seleciona o executor **por action key registrada** —
  `external.*`/`connector.test.*` roteiam para o `ExternalToolStepExecutor` (DI),
  nunca por classe vinda do banco, nunca `eval`/import dinâmico.
- Action keys funcionais: `external.http.request`, `external.webhook.send`.
  `connector.test.echo|failure|timeout` são executores internos de teste
  (determinísticos, sem rede, **proibidos em produção**).

## 2. Como a etapa referencia a ferramenta

A `OperationStep` publicada ganha um campo OPCIONAL
`tool: { alias, actionKey }` (ARDEN-BE-006.6). Na criação da execução, a etapa
externa é materializada com um **snapshot seguro** no input:
`{ $tool: { alias, actionKey }, $source: <input da execução> }` — **sem segredo,
sem URL**. O worker **re-resolve** tudo pelo tenant da LINHA do run (nunca do
payload) a cada tentativa.

## 3. O job

O job da fila continua contendo apenas `{ executionRunId }`. Nenhum segredo, URL
arbitrária, header sensível ou master key entra no job. O tenant vem da linha do run.

## 4. Autorização

Além da autoridade do BE-004 (avaliada na criação) e da `ActionAuthorization`
quando exigida, a criação de execução com etapa externa exige a permissão
**`integration.execute`** (server-side). O alias é validado (fail-fast) na criação e
**revalidado** na execução.

## 5. Resultado

`ExternalToolExecutionResult.status ∈ { SUCCEEDED, FAILED, UNKNOWN }`. UNKNOWN mapeia
para [`EXTERNAL_RESULT_UNKNOWN`](./EXTERNAL_RESULT_UNKNOWN.md). Retry e idempotência
seguem o motor do BE-005 (ver [retry](./EXTERNAL_TOOL_RETRY_POLICY.md)).

## 6. O que NUNCA acontece

- Segredo em job, log, auditoria, evidência, idempotência ou output.
- URL absoluta arbitrária vinda do input (só path relativo dentro do endpoint fixo).
- Executor escolhido por classe do banco; ferramenta desconhecida executando.
- Acesso cross-tenant (resolução sempre `findFirst` por `organizationId`).
