# ARDEN-BE-006 — Matriz de rotas

`operationId → controller → service → permissão → idempotência → revision → auditoria → testes`.
Todas as rotas são tenant-scoped e exigem sessão, EXCETO o webhook de entrada (público,
autenticado por assinatura). Nenhum endpoint público resolve segredos; nenhum endpoint
executa ferramenta diretamente (execução só pelo motor de operações).

## Catálogo (system-managed; tenant via header `X-Arden-Organization`)

| operationId | Método/rota | Controller | Permissão |
| --- | --- | --- | --- |
| connectors.list | GET /connectors | ConnectorsController | connector.view |
| connectors.get | GET /connectors/{connectorKey} | ConnectorsController | connector.view |
| connectors.listTools | GET /connectors/{connectorKey}/tools | ConnectorsController | connector.view |

## Conexões — ConnectionsController → ConnectionsService (revision, idem, state machine, audit)

| operationId | Método/rota | Permissão | Idem | Rev |
| --- | --- | --- | --- | --- |
| connections.list | GET .../connections | connection.view | — | — |
| connections.create | POST .../connections | connection.create | ✓ | — |
| connections.get | GET .../connections/{id} | connection.view | — | — |
| connections.update | PATCH .../connections/{id} | connection.edit | — | ✓ |
| connections.test | POST .../connections/{id}/test | connection.test | ✓ | — |
| connections.activate | POST .../{id}/activate | connection.edit | ✓ | ✓ |
| connections.suspend | POST .../{id}/suspend | connection.edit | ✓ | ✓ |
| connections.reactivate | POST .../{id}/reactivate | connection.edit | ✓ | ✓ |
| connections.revoke | POST .../{id}/revoke | connection.revoke | ✓ | ✓ |

## Credenciais — CredentialsController → CredentialVersionsService (segredo write-only)

| credentials.list | GET .../credentials | connection.view |
| credentials.create | POST .../credentials | connection.rotate_credentials |
| credentials.rotate | POST .../credentials/rotate | connection.rotate_credentials |
| credentials.revoke | POST .../credentials/{credentialVersionId}/revoke | connection.revoke |

## Tool bindings — ToolBindingsController → ToolBindingsService

| toolBindings.list/create/get/update/disable | .../tool-bindings[...] | tool.view / tool.bind |
| operationToolBindings.list/create/update/remove | .../operations/{operationId}/tool-bindings[...] | tool.view / tool.bind |

## Webhooks — WebhooksController (admin) + WebhookInboundController (público)

| webhooks.listEndpoints/getEndpoint | GET .../webhook-endpoints[...] | webhook.view |
| webhooks.createEndpoint/updateEndpoint/suspend/reactivate/revoke | .../webhook-endpoints[...] | webhook.manage |
| webhooks.receive | POST /webhooks/{endpointToken} | **público** (assinatura + replay) |

## Execução (BE-005, reutilizado)

- Execução por API: `executions.create` (execution.create + `integration.execute` quando
  há etapa externa). Execução por webhook: `WebhookInboundService → ExecutionsService.
  createFromSystemTrigger` (actorType SYSTEM; autoridade BE-004 aplicada).
- **Nenhum** `POST /tools/execute` ou execução direta de ferramenta.

## Guards

`AuthenticationGuard → ActiveUserGuard → OrganizationGuard → PermissionGuard` (globais).
`OrganizationGuard` resolve o tenant do path `:organizationId` ou, em rotas
system-managed, do header `X-Arden-Organization` (a org ativa da sessão). Webhook
inbound é `@Public` (sem sessão), autenticado por assinatura HMAC/bearer.
