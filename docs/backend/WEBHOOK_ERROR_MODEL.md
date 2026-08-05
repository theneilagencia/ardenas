# Webhook de entrada — modelo de erros (ARDEN-BE-006.7)

| Código | HTTP | Exposição pública |
| --- | --- | --- |
| `RESOURCE_NOT_FOUND` | 404 | Token inválido ⇒ indistinguível de endpoint inexistente. |
| `WEBHOOK_ENDPOINT_REVOKED` | 404 | Genérico (não revela estado). |
| `WEBHOOK_ENDPOINT_SUSPENDED` | 404 | Genérico. |
| `WEBHOOK_SIGNATURE_INVALID` | 401 | Não revela scheme/segredo. |
| `WEBHOOK_TIMESTAMP_INVALID` | 401 | Genérico. |
| `WEBHOOK_EVENT_NOT_ALLOWED` | 422 | Genérico. |
| `WEBHOOK_REPLAYED` | 409 | Resposta idempotente (200/202 no fluxo feliz de replay). |
| `WEBHOOK_DELIVERY_CONFLICT` | 409 | Mesmo delivery id, payload diferente. Não revela payload. |
| `WEBHOOK_TRIGGER_DENIED` | 403 | Autoridade não permite gatilho de sistema. |
| `REQUEST_TOO_LARGE` | 413 | Payload acima de 256 KB. |
| `RATE_LIMITED` | 429 | Não revela existência do endpoint. |

Nenhum erro revela tenant, `operationId`, hash, política ou stack trace. Sucesso →
`202 Accepted` com `{ accepted, status, correlationId, deliveryId }`. Replay idempotente
→ `202` com `status: 'replayed'`.
