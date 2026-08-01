# Eventos de Auditoria — Governança e Aprovações (ARDEN-BE-004)

Toda mutação relevante grava um evento **append-only** (`AuditRecorder.record`) **dentro
da transação** do comando: uma falha do comando não deixa auditoria de sucesso. Metadados
sensíveis são redigidos (`authorization|token|secret|password|cookie`).

## Políticas

| Ação                          | resourceType                 |
| ----------------------------- | ---------------------------- |
| `policy.created`              | `policy`                     |
| `policy.updated`              | `policy`                     |
| `policy.version_created`      | `policy_version`             |
| `policy.version_updated`      | `policy_version`             |
| `policy.published`            | `policy_version`             |
| `policy.suspended`/`archived` | `policy`                     |
| `policy.bound_to_operation`   | `operation_policy_binding`   |
| `policy.binding_updated`/`removed` | `operation_policy_binding` |

## Fluxos e delegações

`approval_flow.created|updated|activated|suspended` (`approval_flow`);
`approval_delegation.created|revoked` (`approval_delegation`).

## Solicitações, decisões e autorizações

| Ação                                | Momento                                        |
| ----------------------------------- | ---------------------------------------------- |
| `approval_request.created`          | criação (após reavaliação do servidor)         |
| `approval_request.vote_recorded`    | voto que não conclui a etapa                   |
| `approval_request.step_advanced`    | quórum da etapa atingido, avança               |
| `approval_request.approved`         | conclusão (última etapa)                       |
| `approval_request.rejected`         | rejeição encerra                               |
| `approval_request.cancelled`        | cancelamento                                   |
| `approval_request.expired`          | expiração preguiçosa                           |
| `action_authorization.granted`      | emissão da autorização                         |
| `action_authorization.invalidated`  | invalidação (publicação ou preguiçosa)         |
| `action_authorization.expired`      | expiração preguiçosa                           |
| `authority.invalidated_by_publish`  | publicação invalida solicitações/autorizações  |

Cada decisão humana (`ApprovalDecision`) é ela própria imutável e única por
`(solicitação, etapa, aprovador)` — não há evento terminal duplicado nem edição.
