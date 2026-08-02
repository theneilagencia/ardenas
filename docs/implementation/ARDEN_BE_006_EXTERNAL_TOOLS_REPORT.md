# ARDEN-BE-006.6 — Relatório de implementação (ferramentas externas)

Integração dos conectores ao motor de execução do BE-005: tool bindings funcionais,
`ExternalToolStepExecutor` e processamento pelo worker.

## Componentes

| Arquivo | Papel |
| --- | --- |
| `connectors/tools/tool-binding-resolver.ts` | Resolve alias → binding (18 regras), tenant-scoped, auditado. |
| `connectors/tools/connection-resolver.ts` | Valida conexão ACTIVE + credencial ativa (sem resolver segredo). |
| `connectors/tools/external-tool-executor.ts` | Orquestra resolução → credencial → SecureHttpClient → validação → classificação. |
| `connectors/tools/tool-mapping.ts` | DSL declarativa `path/rename/const/compose` (fechada, segura). |
| `connectors/tools/json-schema-validator.ts` | Validação de I/O contra o schema da ferramenta. |
| `connectors/tools/retry-classifier.ts` | SUCCEEDED/FAILED/UNKNOWN + retryable (determinístico). |
| `connectors/tools/auth-builder.ts` | NONE/BEARER/API_KEY/BASIC/HMAC/CUSTOM_FIXED_HEADERS. |
| `connectors/tools/network-policy-runtime.ts` | Política efetiva de runtime (https-only forçado em produção). |
| `executions/external-tool-step.executor.ts` | Ponte StepExecutor → executor; evidência/auditoria sanitizadas. |
| `executions/step-executor-registry.ts` | Seleção por action key registrada (interno estático + externo DI). |
| `connectors/tool-bindings/tool-bindings.controller.ts` | 8 endpoints de bindings (org + operação). |

## Integração com o motor

- `ExecutionProcessor` passa a resolver o executor via `StepExecutorRegistry`.
- `ExecutionsService` materializa a etapa externa com snapshot seguro
  (`$tool` = alias/actionKey; `$source` = input), fail-fast do binding e exige
  `integration.execute`.
- Contrato: `externalActionKey` no enum `executorActionKey`; `operationStep.tool`
  opcional. OpenAPI regenerado.

## Action keys

Funcionais: `external.http.request`, `external.webhook.send` (outbound HMAC opcional).
Teste interno (proibido em produção): `connector.test.echo|failure|timeout`.

## Garantias

Segredo resolvido só no servidor, em memória, descartado após montar auth; ausente de
job/log/audit/evidência/idempotência/output (canário). SecureHttpClient + SSRF
aplicados; URL absoluta do input rejeitada; header sensível do input rejeitado.
Multitenancy por `organizationId`; worker confia no tenant da LINHA do run.
Idempotency-key estável por etapa. UNKNOWN nunca vira sucesso nem retry automático.
Sem endpoint de execução direta; sem nova fila; sem migration.

## Gates

typecheck (api + monorepo), lint (api + monorepo), contracts (53), unit da API (com os
novos specs de tools), integração `external-tool.integration.spec.ts` (14),
`contracts:openapi` sem diff pendente. Ver
[`ARDEN_BE_006_EXTERNAL_TOOLS_TEST_EVIDENCE.md`](./ARDEN_BE_006_EXTERNAL_TOOLS_TEST_EVIDENCE.md).
