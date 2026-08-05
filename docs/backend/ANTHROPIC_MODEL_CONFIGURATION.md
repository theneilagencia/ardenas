# Configuração de modelo Anthropic (ARDEN-BE-008.1)

> Contrato apenas (`implementationStatus=CONTRACT_ONLY`). **Nenhuma mudança de Prisma nesta
> fase.** Reusa a `ModelConfiguration` existente do BE-007.2 — sem tabela nem campo novo.
> Provider `anthropic.direct` v`1`. Fonte de fatos: `ANTHROPIC_OFFICIAL_SOURCE_REGISTER.md`.

## 1. Shape reusado (BE-007.2, sem alteração)

A `ModelConfiguration` é tenant-scoped e já expõe exatamente os campos necessários:

```
{
  providerKey:            'anthropic.direct',
  providerVersion:        1,
  modelId:                '<alias|snapshot da allowlist>',   // ANTHROPIC_MODEL_CATALOG.md §1
  credentialConnectionId: '<ref ao cofre BE-006>',           // nunca a key
  parameters:             { ... },                            // ver §2 (discriminado por provider)
  status:                 'DRAFT'|'ACTIVE'|'SUSPENDED'|'REVOKED',
  revision:               <int>,
}
```

`modelId` é validado contra a allowlist FECHADA do provider; nunca deriva do input de
execução. `credentialConnectionId` deve pertencer ao mesmo tenant (`ANTHROPIC_CREDENTIAL_CONTRACT.md`).

## 2. Parâmetros permitidos (discriminados por provider)

O `parameters` NÃO é objeto livre: é um schema **discriminado por `providerKey`**. Para
`anthropic.direct`, apenas os parâmetros mapeáveis a `messages.create` (VERIFIED como params
do request no SDK v0.115.0):

| Parâmetro canônico | Campo Anthropic | Faixa |
| --- | --- | --- |
| `maximumOutputTokens` | `max_tokens` (obrigatório na API) | UNVERIFIED (limite por modelo em docs 403) |
| `temperature` | `temperature?` | UNVERIFIED (faixa exata em docs 403) |
| `top_p` | `top_p?` | UNVERIFIED |
| `stop_sequences` | `stop_sequences?` | UNVERIFIED (limite de quantidade) |

Outros campos do request (`system`, `messages`, `tools`, `tool_choice`, `stream`,
`thinking`, `service_tier`, `metadata`) são montados pelo runtime/adapter, **não** são
parâmetros de configuração do tenant. Faixas marcadas UNVERIFIED precisam de leitura direta
antes de 008.2 — não presumir defaults.

## 3. Invariantes

- segredo NUNCA em `parameters` (é credencial — `ANTHROPIC_CREDENTIAL_CONTRACT.md`);
- ativação em produção exige `productionAllowed=true` no provider; como `anthropic.direct`
  é `productionAllowed=false`/`status=DISABLED` nesta fase, ativação em produção é bloqueada
  (`MODEL_PROVIDER_DISABLED`) — comportamento do `MODEL_CONFIGURATION_LIFECYCLE.md`;
- a resposta expõe só `providerKey`/`providerVersion`/`modelId`/`parameters`/`status`/
  `revision`/`credentialConnectionId`; nunca `providerDefinitionId` nem segredo;
- edição via PATCH com `revision`; troca de status é comando dedicado.
