# Webhook de entrada — arquitetura (ARDEN-BE-006.7)

> Entrada segura de eventos externos e integração controlada com o motor do BE-005.
> Nenhuma fila, worker, idempotência, auditoria ou evidência nova — tudo reutiliza a
> infraestrutura existente.

## Pipeline

```
WebhookInboundController (público, raw body)
→ WebhookRateLimiter        (tokenHash + IP)
→ WebhookEndpointsRepository (lookup por hash → tenant da linha)
→ WebhookInboundService
  → autenticação (assinatura + timestamp)
  → event type allowlist
  → replay guard + WebhookDelivery (state machine)
  → ExecutionsService.createFromSystemTrigger  (motor BE-005, idempotente)
  → ExecutionQueue → ExecutionWorker
  → AuditRecorder / EvidenceRecorder (sanitizados)
```

## Componentes

| Arquivo | Papel |
| --- | --- |
| `webhook-inbound.controller.ts` | Controller PÚBLICO fino. `@Public`, lê raw body, delega tudo. |
| `webhook-inbound.service.ts` | Orquestra o pipeline. Tenant vem do endpoint, nunca do request. |
| `webhook-token.ts` | Token opaco `whk_` (256 bits), hash SHA-256, comparação constant-time. |
| `webhook-signature.ts` | HMAC sobre raw body, bearer estático, validação de timestamp (puro). |
| `webhook-rate-limiter.ts` | Rate limit básico em processo por `tokenHash+IP`. |
| `webhooks.service.ts` | Admin: cria/edita/transiciona endpoints; grava a delivery; cifra o segredo. |
| `webhooks.controller.ts` | Endpoints administrativos (tenant-scoped, permissões). |
| `webhooks-inbound.module.ts` | Módulo isolado (importa Connectors + Executions) para evitar ciclo. |

## Módulo isolado

`WebhooksInboundModule` importa `ConnectorsModule` (repos/serviços de webhook, cofre) e
`ExecutionsModule` (criação de execução). Fica separado porque `ExecutionsModule` já
importa `ConnectorsModule` (executor externo) — um módulo próprio evita dependência
circular.
