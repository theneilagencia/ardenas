# Anthropic — observabilidade em runtime (ARDEN-BE-008.3)

> Métricas de provider (in-memory, low-cardinality), evidência/auditoria pelo recorder já
> existente (BE-007.6) e allowlist de log. O **segredo nunca aparece em nenhum sink**. Fonte:
> `agent-metrics.ts`.

## 1. Métricas (VERIFIED)

In-memory, labels de baixa cardinalidade. Nesta fase o label `retryable` foi adicionado.

| Métrica | Tipo |
| --- | --- |
| `arden_model_provider_requests_total` | counter |
| `arden_model_provider_request_duration_ms` | histogram |
| `arden_model_provider_errors_total` | counter |
| `arden_model_provider_rate_limits_total` | counter |
| `arden_model_provider_unknown_results_total` | counter |
| `arden_model_provider_input_tokens_total` | counter |
| `arden_model_provider_output_tokens_total` | counter |

**Labels**: `provider`, `model`, `status`, `error_code`, `retryable`.

## 2. Labels proibidos

Nenhuma métrica recebe `tenant` / `organizationId` / `run` / `user` / `apiKey` — cardinalidade
alta e/ou identificação são proibidas. Labels são exclusivamente os do §1.

## 3. Auditoria e evidência (recorder existente)

Evidência de model-call + eventos continuam pelo recorder do BE-007.6: usage, hashes
(`outputSchemaHash`/`outputHash`, `providerRequestId` só como hash), status. Nenhum caminho
novo de persistência de evidência.

## 4. Allowlist de log

Logs recebem apenas campos allowlisted: `correlationId`, provider, model, status, código de
erro canônico, contagem de tentativas, `retryable`. **Nunca** prompt, output, system, corpo do
request/response, headers, ou a apiKey.

## 5. O segredo nunca aparece em nenhum sink (VERIFIED)

A apiKey **não** aparece em: logs, auditoria, evidência, métricas, usage, job, checkpoint. O
fake transport registra apenas o **comprimento** da apiKey recebida (nunca o valor) — canário
de teste. Ver `ANTHROPIC_OFFLINE_TEST_TRANSPORT.md`.

## 6. NUNCA

- adicionar `tenant`/`run`/`user`/`apiKey` como label de métrica;
- logar prompt/output/system/corpo/headers/apiKey;
- criar caminho novo de evidência fora do recorder BE-007.6;
- persistir `providerRequestId` em claro.
