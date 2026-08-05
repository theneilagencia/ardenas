# ARDEN-BE-006.7 — Relatório de implementação (webhooks de entrada)

Entrada segura de eventos por webhook e integração controlada com o motor do BE-005.

## Componentes

| Arquivo | Papel |
| --- | --- |
| `webhooks/webhook-token.ts` | Token opaco `whk_` (256 bits), hash SHA-256, constant-time. |
| `webhooks/webhook-signature.ts` | HMAC sobre raw body, bearer estático, timestamp (puro). |
| `webhooks/webhook-rate-limiter.ts` | Rate limit em processo por tokenHash+IP. |
| `webhooks/webhook-inbound.service.ts` | Pipeline de entrada (auth → replay → delivery → trigger). |
| `webhooks/webhook-inbound.controller.ts` | Controller público `@Public` (raw body). |
| `webhooks/webhooks.service.ts` | Admin + cifra do segredo no cofre + delivery. |
| `webhooks/webhooks.controller.ts` | Endpoints administrativos. |
| `webhooks/webhooks-inbound.module.ts` | Módulo isolado (evita ciclo Connectors↔Executions). |
| `executions/executions.service.ts` | `createFromSystemTrigger` (reuso do motor BE-005). |
| `vault/credential-resolver.ts` | `resolveCredentialVersion` (segredo de assinatura). |

## Reuso (sem duplicação)

- Fila/worker/processor do BE-005 reutilizados; `createFromSystemTrigger` só adiciona o
  ponto de entrada de SISTEMA (materializa run+steps e enfileira via os MESMOS repos).
- Idempotência via `triggerReference` + dedup de delivery; sem sistema paralelo.
- Auditoria/evidências via `AuditRecorder`/`ExecutionRecorder` existentes.
- Cofre AES-256-GCM (006.4) para o segredo de assinatura.

## Segurança

Token opaco (hash), one-time (não reexposto em replay, não em `idempotency_records`),
segredo cifrado e resolvido server-side, HMAC sobre raw body constant-time, timestamp +
replay, tenant sempre do endpoint, NONE proibido em produção, gatilho só quando
autoridade ALLOWED, rate limit, limite de payload, respostas públicas mínimas.

## Contrato / OpenAPI

`webhookEndpointSecret` agora tem `endpointUrl` e `endpointToken` nullable (replay não
reexpõe); `inboundWebhookAcceptedResponse` inclui `accepted` + `correlationId`; 3 novos
códigos de erro (`WEBHOOK_ENDPOINT_SUSPENDED/TRIGGER_DENIED/DELIVERY_CONFLICT`). OpenAPI
regenerado.

## Migration

Nenhuma — os modelos `WebhookEndpoint`/`WebhookDelivery` e a constraint única de
`external_delivery_id` já existiam (006.3). Sem edição de migration aplicada.
