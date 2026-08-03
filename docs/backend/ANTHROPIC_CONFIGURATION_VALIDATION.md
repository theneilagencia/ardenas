# Validação de configuração Anthropic (ARDEN-BE-008.2)

> Duas operações **distintas**. Nenhuma delas chama a Anthropic nesta fase. A validação
> é **LOCAL** e declara sempre `NOT_VERIFIED_WITH_PROVIDER`.

## 1. Operação (a): "test" de rede (BE-006) — NÃO usada

O teste de rede do BE-006 (para conectores HTTP) **não** se aplica ao Anthropic e
**nunca** chama o provider. O conector Anthropic não expõe ferramenta de geração.

## 2. Operação (b): validate-configuration (LOCAL, novo)

```
POST /organizations/{orgId}/connections/{id}/validate-configuration
     # permissão connection.test
```

Valida, sem sair da fronteira do sistema:

- **configuração** contra o `configurationSchema` do conector (`baseUrlMode` etc.);
- **presença de credencial** (existe versão `ACTIVE`);
- **decifrabilidade no vault** — decifra e **descarta o plaintext** (nunca o retorna);
- **compatibilidade** provider/conector (conector `ACTIVE`).

## 3. Resultado: sempre NOT_VERIFIED_WITH_PROVIDER

```
{ providerVerificationStatus: 'NOT_VERIFIED_WITH_PROVIDER', ... }
```

`VERIFIED_WITH_PROVIDER` é **reservado para 008.3+** (quando houver chamada real). Nesta
fase o resultado nunca afirma verificação pelo provider.

## 4. Vocabulário PROIBIDO

Esta operação **não** pode ser chamada de:

- "Test Anthropic connection";
- "Connection verified";
- "Credentials confirmed by Anthropic".

Ela valida forma e decifrabilidade **localmente** — não confirma a key na Anthropic.

## 5. Validação de parâmetros Anthropic

Schema **estrito** de parâmetros de modelo:

- **aceita** apenas: `maximumOutputTokens`, `temperature`, `topP`, `stopSequences`;
- **rejeita**: `apiKey`, `baseUrl`, `model`, `headers`, `tools`, `system`,
  `organizationId`, `timeout`, `retry` (credencial/transporte/roteamento não são
  parâmetros de tenant);
- `modelId` validado contra **allowlist** de snapshots datados.
