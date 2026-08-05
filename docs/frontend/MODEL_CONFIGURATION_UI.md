# UI de configurações de modelo (ARDEN-BE-007.7)

`ModelConfigurationsPage.tsx` — catálogo de providers (somente leitura) + CRUD de
configurações de modelo (tenant-scoped) sobre a API v1 real.

## Catálogo de providers

`useModelProviders()` → `GET /model-providers` (público, somente leitura). A tabela mostra
nome, `key`, capacidades e **"produção permitida"**. Provider com `productionAllowed=false`
recebe o selo **"Somente teste"**. Não há criação/edição de provider pela UI.

## Allowlist fechada de modelId

O `modelId` **não** é texto livre arbitrário: os IDs vêm do catálogo de contrato
(`MODEL_RATE_CARDS`, filtrado por `providerKey`) apresentado como `<select>`. Sem provider
comercial e **sem campo de API key** nesta fase (nota `noApiKey` no formulário) — a
credencial é referência a uma conexão do cofre, não um segredo digitado aqui.

## `internal.test-model`

Marcado como **somente teste / não permitido em produção**. O provider correspondente
aparece com o selo "Somente teste" e um aviso "não permitido em produção" ao ser
selecionado no drawer de criação.

## Ciclo de vida (comandos do backend)

`DRAFT → ACTIVE → SUSPENDED → REVOKED` via comandos, nunca inferido no cliente:

| Estado | Ações disponíveis |
| --- | --- |
| DRAFT | ativar |
| ACTIVE | suspender |
| SUSPENDED | reativar (ativar) |
| qualquer ≠ REVOKED | revogar (confirmação) |

Cada comando envia `expectedRevision` (concorrência otimista) e usa idempotência mintada no
repositório. O editor de versão só oferece configurações `ACTIVE`
(`useModelConfigurations({ status: 'ACTIVE' })`).
