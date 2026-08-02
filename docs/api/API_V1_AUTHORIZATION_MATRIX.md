# Arden.AS — API v1 · Matriz de Autorização (ARDEN-FE-003)

> Mapeia cada endpoint à **permissão estável** do catálogo consolidado no
> ARDEN-FE-002 (`src/domain/permissions.ts`). O **cliente não envia permissões**; o
> backend as resolve da sessão e valida cada ação. Endpoints de sessão são de
> **autenticação** (sem permissão de domínio).

## Reconciliação com o §21 do enunciado

O enunciado exemplifica ids como `operation.update` e `operation.archive`. O
catálogo estável **não** possui esses ids — para não inventar um segundo catálogo
incompatível (§34), usamos os existentes:

| Exemplo do §21 | Id estável usado |
|---|---|
| `operation.update` (editar) | `operation.edit` |
| `operation.archive` (arquivar) | `operation.edit` |
| `operation.view` / `operation.create` / `operation.publish` / `audit.view` | idênticos (já existem) |

Pausar/retomar usam `operation.pause`. Duplicar usa `operation.create`.

## Matriz

| # | Endpoint (operationId) | Método | Path | Permissão | Idem. | Concorr. |
|---|---|---|---|---|---|---|
| 1 | `session.get` | GET | `/session` | — (autenticação) | não | não |
| 2 | `session.refresh` | POST | `/session/refresh` | — | não | não |
| 3 | `session.switchOrganization` | POST | `/session/switch-organization` | — (valida membership) | não | não |
| 4 | `session.logout` | POST | `/session/logout` | — | não | não |
| 5 | `operations.list` | GET | `/organizations/{organizationId}/operations` | `operation.view` | não | não |
| 6 | `operations.create` | POST | `/organizations/{organizationId}/operations` | `operation.create` | **sim** | não |
| 7 | `operations.get` | GET | `…/operations/{operationId}` | `operation.view` | não | não |
| 8 | `operations.update` | PATCH | `…/operations/{operationId}` | `operation.edit` | não | **sim** |
| 9 | `operations.archive` | POST | `…/operations/{operationId}/archive` | `operation.edit` | **sim** | **sim** |
| 10 | `operations.duplicate` | POST | `…/operations/{operationId}/duplicate` | `operation.create` | **sim** | não |
| 11 | `operations.pause` | POST | `…/operations/{operationId}/pause` | `operation.pause` | não | **sim** |
| 12 | `operations.resume` | POST | `…/operations/{operationId}/resume` | `operation.pause` | não | **sim** |
| 13 | `operationVersions.list` | GET | `…/versions` | `operation.view` | não | não |
| 14 | `operationVersions.create` | POST | `…/versions` | `operation.edit` | **sim** | não |
| 15 | `operationVersions.get` | GET | `…/versions/{versionId}` | `operation.view` | não | não |
| 16 | `operationVersions.update` | PATCH | `…/versions/{versionId}` | `operation.edit` | não | **sim** |
| 17 | `operationVersions.publish` | POST | `…/versions/{versionId}/publish` | `operation.publish` | **sim** | **sim** |
| 18 | `operationVersions.compare` | GET | `…/versions/{versionId}/compare/{otherVersionId}` | `operation.view` | não | não |
| 19 | `authority.get` | GET | `…/versions/{versionId}/authority` | `operation.view` | não | não |
| 20 | `authority.update` | PATCH | `…/versions/{versionId}/authority` | `operation.edit` | não | **sim** |
| 21 | `audit.list` | GET | `/organizations/{organizationId}/audit-events` | `audit.view` | não | não |
| 22 | `audit.get` | GET | `…/audit-events/{eventId}` | `audit.view` | não | não |

## Tabela mínima exigida (§21)

| Ação | Método | Permissão |
|---|---|---|
| listar operações | GET | `operation.view` |
| criar operação | POST | `operation.create` |
| editar operação | PATCH | `operation.edit` |
| publicar versão | POST | `operation.publish` |
| arquivar operação | POST | `operation.edit` |
| consultar auditoria | GET | `audit.view` |

O teste `src/contracts/contracts.test.ts` garante que **toda** permissão de endpoint
pertence a `ALL_PERMISSIONS` e que endpoints de sessão têm permissão nula.

## Governança, aprovações e enforcement (ARDEN-BE-004)

| Ação | Método | Permissão |
|---|---|---|
| listar/consultar políticas | GET | `policy.view` |
| criar política | POST | `policy.create` |
| editar política / versão / vínculo | PATCH/POST | `policy.edit` |
| publicar versão de política | POST | `policy.publish` |
| suspender/arquivar política | POST | `policy.suspend` |
| listar/consultar fluxos e solicitações | GET | `approval.view` |
| criar/editar/ativar/suspender fluxo | POST/PATCH | `policy.manage` |
| solicitar aprovação de ação | POST | `approval.request` |
| aprovar/rejeitar solicitação | POST | `approval.resolve` |
| cancelar solicitação | POST | `approval.cancel` |
| criar/revogar delegação | POST | `approval.delegate` |
| avaliar ação / validar autorização | POST | `authority.evaluate` |

A decisão de autorização é **sempre do servidor** — a permissão de tela nunca autoriza a
ação; a autoridade final é reavaliada contra a versão publicada e as políticas vinculadas.

## Execução (ARDEN-BE-005)

| Ação | Método | Permissão |
|---|---|---|
| listar/consultar execuções, etapas, eventos | GET | `execution.view` |
| iniciar execução | POST | `execution.create` |
| pausar execução | POST | `execution.pause` |
| retomar execução | POST | `execution.resume` |
| cancelar execução | POST | `execution.cancel` |
| reprocessar execução | POST | `execution.retry` |
| listar/consultar evidências | GET | `evidence.view` |

O worker executa sob a autoridade da execução criada; nunca ignora a autorização e
nunca aceita o tenant vindo do payload sem validação.

## ARDEN-BE-006 — Connectors and External Tools (contratado)

> Endpoints **contratados** nesta fase (006.2); implementação funcional nas fases
> seguintes. Catálogo é público (leitura por `connector.view`). O webhook de entrada
> é **público** (autenticado por assinatura/token — sem permissão de usuário). Toda
> permissão pertence à fonte única `src/domain/permissions.ts`; o teste
> `src/contracts/contracts.test.ts` garante que cada permissão de endpoint ∈ `ALL_PERMISSIONS`.

| operationId | Método | Path | Permission | Idempotency | Revision |
|---|---|---|---|---|---|
| connectors.list / get / listTools | GET | `/connectors...` | `connector.view` | não | não |
| connections.list / get | GET | `.../connections...` | `connection.view` | não | não |
| connections.create | POST | `.../connections` | `connection.create` | sim | não |
| connections.update | PATCH | `.../connections/{id}` | `connection.edit` | não | sim |
| connections.test | POST | `.../connections/{id}/test` | `connection.test` | sim | não |
| connections.activate/suspend/reactivate | POST | `.../connections/{id}/...` | `connection.edit` | sim | sim |
| connections.revoke | POST | `.../connections/{id}/revoke` | `connection.revoke` | sim | sim |
| credentials.list | GET | `.../credentials` | `connection.view` | não | não |
| credentials.create / rotate | POST | `.../credentials[/rotate]` | `connection.rotate_credentials` | sim | rotate: sim |
| credentials.revoke | POST | `.../credentials/{id}/revoke` | `connection.revoke` | sim | não |
| toolBindings.list / get | GET | `.../tool-bindings...` | `tool.view` | não | não |
| toolBindings.create / update / disable | POST/PATCH | `.../tool-bindings...` | `tool.bind` | create/disable: sim | update/disable: sim |
| operationToolBindings.* | GET/POST/PATCH/DELETE | `.../operations/{id}/tool-bindings...` | `tool.view` / `tool.bind` | create: sim | update/remove: sim |
| webhooks.listEndpoints / getEndpoint | GET | `.../webhook-endpoints...` | `webhook.view` | não | não |
| webhooks.createEndpoint | POST | `.../webhook-endpoints` | `webhook.manage` | sim | não |
| webhooks.updateEndpoint | PATCH | `.../webhook-endpoints/{id}` | `webhook.manage` | não | sim |
| webhooks.suspend/reactivate/revoke | POST | `.../webhook-endpoints/{id}/...` | `webhook.manage` | sim | sim |
| webhooks.receive | POST | `/webhooks/{endpointToken}` | **público (assinatura)** | replay-idempotente | não |

Permissão adicional `integration.execute` valida o uso de ferramenta externa na criação de execução (BE-005), além de `execution.create`. Papéis iniciais: `corporate_admin` (todas), `security_admin` (gestão completa de conexões/credenciais/webhooks), `operation_owner` (view + `tool.bind` + `integration.execute`), `supervisor` (view + `connection.test` + `integration.execute`), `auditor` (somente leitura).
