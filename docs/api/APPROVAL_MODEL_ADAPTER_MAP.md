# Mapa de Adaptação — Aprovações (Frontend ↔ API v1)

Conecta a UI de aprovações (master-detail, delegar, solicitar) aos recursos v1. Em modo
`api` **não há fallback**.

## Recursos e endpoints

| Recurso              | Endpoint v1                                                        |
| -------------------- | ----------------------------------------------------------------- |
| Fluxos               | `GET|POST /organizations/{org}/approval-flows`, `GET|PATCH …/{flowId}`, `POST …/{flowId}/activate|suspend` |
| Avaliar ação         | `POST …/operations/{op}/actions/evaluate`                         |
| Solicitar aprovação  | `POST …/operations/{op}/approval-requests` (idempotente)         |
| Listar/consultar     | `GET …/approval-requests`, `GET …/approval-requests/{id}`        |
| Aprovar/rejeitar     | `POST …/approval-requests/{id}/approve|reject`                   |
| Cancelar             | `POST …/approval-requests/{id}/cancel`                           |
| Delegações           | `GET|POST …/approval-delegations`, `POST …/{id}/revoke`          |
| Validar autorização  | `POST …/action-authorizations/validate`                          |

## Fluxo de decisão na UI

1. Antes de agir, a UI chama **evaluate** e usa `decision` para orientar
   (`ALLOWED` → prosseguir; `DENIED` → bloquear; `APPROVAL_REQUIRED` → abrir solicitação).
   O resultado é **informativo** — a autoridade final é reavaliada no servidor.
2. Para aprovar, envia `expectedRevision` (concorrência) e, quando exigido,
   `justification`. A UI **nunca** envia o aprovador final nem decide elegibilidade.

## Campos (contrato → UI)

- `status` da solicitação (`PENDING|APPROVED|REJECTED|CANCELLED|EXPIRED|INVALIDATED`).
- `currentStepSequence` + fluxo → progresso das etapas.
- `authorization` (no retorno de `approve`) → prova terminal; `validate` confirma validade.
- Erros de governança (`SELF_APPROVAL_FORBIDDEN`, `APPROVAL_NOT_ELIGIBLE`,
  `APPROVAL_ALREADY_DECIDED`, `APPROVAL_EXPIRED`, `APPROVAL_INVALIDATED`, `ACTION_DENIED`)
  → mensagens de negação; um botão renderizado nunca implica autorização.
