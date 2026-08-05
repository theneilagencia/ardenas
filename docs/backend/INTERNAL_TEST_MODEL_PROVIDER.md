# Provider de modelo determinístico interno (ARDEN-BE-007.3)

`internal.test-model@1`, `productionAllowed=false`, capability `STRUCTURED_OUTPUT`. SEM SDK,
SEM internet, SEM segredo, SEM relógio real. Cenários escolhidos por `modelId` de uma
ALLOWLIST fechada — nunca por payload público arbitrário.

| modelId | comportamento |
| --- | --- |
| `test/structured-success` | output válido (derivado do outputSchema) |
| `test/structured-invalid` | output inválido (sempre) |
| `test/structured-repairable` | inválido; VÁLIDO quando há mensagem de repair (`[arden:repair]`) |
| `test/content-filtered` | finishReason `CONTENT_FILTER` |
| `test/timeout` | lança kind `TIMEOUT` |
| `test/rate-limit` | lança kind `RATE_LIMIT` |
| `test/provider-error` | lança kind `PROVIDER_ERROR` |
| `test/unknown-result` | lança kind `UNKNOWN` |

`modelId` fora da allowlist → `UNSUPPORTED_MODEL`. Nunca produz tool calls. Usage
determinística (`estimateTokens = ceil(bytesUTF8/4)`, custo nulo). Timeout é simulado sem
`sleep` real (§10). Providers comerciais NÃO existem nesta fase.
