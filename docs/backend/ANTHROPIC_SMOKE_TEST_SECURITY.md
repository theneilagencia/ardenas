# Anthropic — segurança do smoke test (ARDEN-BE-008.4)

> Como o smoke test real obtém a credencial, o que sanitiza e o que **nunca** expõe. A API key
> vem exclusivamente do cofre e nunca é impressa, persistida ou logada. Fonte: código do
> 008.4B. Complementa `ANTHROPIC_REQUEST_SECURITY.md` / `ANTHROPIC_RESPONSE_SECURITY.md`.

## 1. Origem da credencial (VERIFIED)

A API key resolve **exclusivamente** de:

```
OrganizationConnection → CredentialVersion ativa → SecretVault
```

**NUNCA** de argumento de CLI, variável de ambiente, arquivo ou fixture. O operador informa
`--organizationId`/`--connectionId`/`--modelConfigurationId` (identificadores, não segredos); a
key é resolvida server-side, usada em memória no contexto de transporte e descartada. A key
**nunca** é impressa, persistida nem logada.

## 2. Política de canário (VERIFIED)

A API key **real nunca** é usada como canário de segredo. O canário nos testes é um valor
sintético (o fake transport registra apenas o **comprimento** da apiKey, nunca o valor). O teste
`PASSED + credential-version marked + canary absent` comprova que nenhum canário de segredo real
aparece em log/audit/evidência/métrica após o caminho de sucesso.

## 3. O que NUNCA é exposto (VERIFIED)

O `AnthropicSmokeTestResult` e a trilha de auditoria **nunca** contêm:

- `apiKey` / qualquer segredo do cofre;
- o `prompt` / payload sintético bruto;
- request ou response **bruto** do provider;
- `headers` (incl. cabeçalhos de auth);
- o **request ID bruto** do provider.

Em vez do conteúdo bruto, guardam-se apenas `requestIdHash` e `responseHash` (sha256) e
contadores de token — ver `ANTHROPIC_LIVE_TEST_EVIDENCE_MODEL.md`.

## 4. Sanitização do resultado (VERIFIED)

O resultado carrega só metadados não-secretos: status, `organizationId`, `connectionId`,
`modelConfigurationId`, `providerKey`, `modelId`, flags de validação, tokens reportados,
`estimatedCostMinor=null`, `currency=null`, hashes, `errorCode`, `durationMs`, `performedAt`.
Nenhum campo de conteúdo. O custo permanece `null` (sem rate card verificado).

## 5. Auditoria sem conteúdo (VERIFIED)

Eventos `anthropic.smoke_test_*` registram org/connection/modelConfig/modelId/
credentialVersionId/requestIdHash/responseHash/usage/duration/status/operator/timestamp —
**nunca** conteúdo nem key. Detalhe em `ANTHROPIC_LIVE_TEST_EVIDENCE_MODEL.md`.

## 6. NUNCA

- aceitar a API key por CLI/env/arquivo/fixture;
- imprimir, persistir ou logar a API key (nem em erro);
- usar a key real como canário;
- emitir prompt/raw request/raw response/headers/request ID bruto em resultado, log ou audit.
