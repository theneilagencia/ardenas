# Webhook de entrada — evidências (ARDEN-BE-006.7)

Para execução criada por webhook, a evidência `INPUT` (sanitizada) registra:
`webhookEndpointId`, `webhookDeliveryId`, `eventType`, `payloadHash`, `payloadBytes`,
`signatureScheme`, `timestamp` validado, `externalDeliveryId` (quando seguro),
`operationId`, `correlationId`, além do `inputHash`.

**Nunca** registra o raw body integral, assinatura, segredo, bearer, Authorization ou
headers completos. O `ExecutionRecorder`/`AuditRecorder` sanitizam recursivamente
(`authorization|token|secret|password|cookie|bearer`). O payload validado só entra em
`ExecutionRun.input`, sob as políticas do BE-005.

## Auditoria

`webhook.endpoint_created/updated/suspended/reactivated/revoked`, `webhook.received`,
`webhook.signature_validated/signature_rejected`, `webhook.timestamp_rejected`,
`webhook.event_rejected`, `webhook.replayed`, `webhook.accepted`,
`webhook.trigger_created`, `webhook.execution_created`, `webhook.execution_denied`,
`webhook.processed`, `webhook.failed`. Reutiliza `audit_events`; metadata sanitizada.
