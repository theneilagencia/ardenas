# Anthropic — modelo de evidência do smoke test (ARDEN-BE-008.4)

> `AnthropicSmokeTestResult` sanitizado + eventos de auditoria. Só metadados não-secretos e
> **hashes**; nunca conteúdo bruto, key, prompt, request/response bruto, headers ou request ID
> bruto. Fonte: código do 008.4B. Complementa `ANTHROPIC_RESPONSE_SECURITY.md`.

## 1. `AnthropicSmokeTestResult` (VERIFIED)

| Campo | Descrição |
| --- | --- |
| `status` | `PASSED` \| `FAILED` \| `UNKNOWN` |
| `organizationId` / `connectionId` / `modelConfigurationId` | identificadores (não segredos) |
| `providerKey` / `modelId` | `anthropic.direct` / snapshot allowlisted |
| `authenticationValidated` | auth aceita pelo provider |
| `structuredOutputValidated` | output passou na validação local de JSON Schema |
| `inputTokens` / `outputTokens` / `cachedInputTokens` | apenas o que o provider reporta |
| `estimatedCostMinor` | **`null`** (sem rate card verificado) |
| `currency` | **`null`** |
| `requestIdHash` / `responseHash` | **sha256** (nunca o bruto) |
| `errorCode` | código canônico em falha |
| `durationMs` / `performedAt` | duração e timestamp |

**NUNCA** neste resultado: `apiKey`, `prompt`, request/response **bruto**, `headers`, request
ID **bruto**.

## 2. Hashes em vez de conteúdo (ARCHITECTURAL_DECISION)

`requestIdHash` e `responseHash` são **sha256** — permitem correlacionar/verificar sem
armazenar conteúdo. O request ID bruto do provider e o corpo bruto de request/response nunca são
guardados. Tokens são os contadores reportados pelo provider (nada derivado de conteúdo).

## 3. Eventos de auditoria (VERIFIED)

`anthropic.smoke_test_requested` · `preflight_passed` · `started` · `succeeded` · `failed` ·
`unknown`. Cada evento carrega: `organizationId`, `connectionId`, `modelConfigurationId`,
`modelId`, `credentialVersionId`, `requestIdHash`, `responseHash`, `usage`, `duration`,
`status`, `operator`, `timestamp`. **Nunca** conteúdo nem key.

## 4. Evidência de `PASSED` (VERIFIED)

Em `PASSED`, a verificação é gravada nos metadados da versão de credencial
(`smokeTest={status:PASSED, credentialVersionId, modelId, at}`) — ver
`ANTHROPIC_CREDENTIAL_REVALIDATION.md`. É a única evidência persistida de que aquela versão de
credencial passou; rotação a invalida.

## 5. Custo na evidência (VERIFIED)

Mesmo com usage real, `estimatedCostMinor=null` e `currency=null` — pricing UNVERIFIED, sem rate
card. A evidência jamais grava custo `0` como conhecido; ausência de preço verificado é `null` +
`COST_RATE_CARD_NOT_AVAILABLE`.

## 6. NUNCA

- gravar key/prompt/raw request/raw response/headers/request ID bruto em resultado ou audit;
- persistir custo estimado sem rate card verificado;
- emitir evidência de `PASSED` fora dos metadados da versão de credencial;
- registrar hash de conteúdo que permita reconstruir o conteúdo (só sha256 de id/response).
