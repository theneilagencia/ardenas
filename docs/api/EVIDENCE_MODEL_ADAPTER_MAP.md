# Mapa de Adaptação — Evidências (Frontend ↔ API v1)

| Recurso | Endpoint v1 | Permissão |
| --- | --- | --- |
| Listar evidências | `GET /organizations/{org}/executions/{id}/evidence` | `evidence.view` |
| Consultar evidência | `GET …/evidence/{evidenceId}` | `evidence.view` |

| Campo API | UI | Observação |
| --- | --- | --- |
| `evidenceType` | rótulo | INPUT/OUTPUT/DECISION/AUTHORIZATION/ERROR/STATE_TRANSITION/COMPENSATION |
| `content` | detalhe | já sanitizado no servidor (sem segredo) |
| `contentHash` | integridade | SHA-256 do conteúdo canônico |
| `createdByType` | origem | USER/SYSTEM/WORKER |
| `createdAt` | timestamp | — |

Evidências são somente leitura no cliente; não há geração local de evidência no modo api.
