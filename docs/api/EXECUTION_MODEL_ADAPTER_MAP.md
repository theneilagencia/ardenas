# Mapa de Adaptação — Execução (Frontend ↔ API v1)

Em modo `api` **não há fallback** para mock/IndexedDB e **nenhuma** simulação local
(sem `setTimeout` para fingir processamento, sem mudança local de status).

| Recurso | Endpoint v1 |
| --- | --- |
| Listar/consultar | `GET /organizations/{org}/executions[/{id}]` |
| Iniciar | `POST /organizations/{org}/operations/{op}/executions` (idempotente) |
| Pausar/Retomar/Cancelar/Retry | `POST …/executions/{id}/pause|resume|cancel|retry` |
| Etapas | `GET …/executions/{id}/steps[/{stepId}]` |
| Eventos | `GET …/executions/{id}/events` |

## Campos (contrato → UI)

- `status` (14 estados) → selo/estado; `currentStepId` → etapa atual.
- `attemptCount`/`maxAttempts` → progresso de tentativas; `errorCode`/`errorSummary` → erro.
- `revision` → `expectedRevision` nos comandos (concorrência otimista).

## Polling (§31)

Acompanhar por **polling** (sem WebSocket nesta fase): intervalo inicial curto com
backoff, parada em estado terminal, cancelamento ao trocar de tenant, sem misturar dados
entre organizações. SSE/WebSocket ficam para marco futuro.
