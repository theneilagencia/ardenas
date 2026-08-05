/**
 * Arden.AS — API v1 · webhooks (ARDEN-BE-006).
 *
 * WebhookEndpoint (entrada) e WebhookDelivery. A RESPOSTA nunca inclui o hash
 * interno do token nem o id da versão de credencial. O token do endpoint e um
 * eventual segredo de assinatura são retornados UMA ÚNICA VEZ na criação
 * (write-once), em resposta específica. `NONE` (sem assinatura) não é default e
 * exige reconhecimento explícito de insegurança.
 */

import { z } from 'zod';
import { isoUtcDateTime } from '../common/timestamps';
import {
  webhookEndpointId,
  webhookDeliveryId,
  connectionId,
  operationId,
  operationVersionId,
  organizationId,
  userId,
  correlationId,
} from '../common/identifiers';
import { webhookEndpointStatus, webhookSignatureScheme, webhookDeliveryStatus } from './connector-keys';

const eventType = z.string().min(1).max(120);

/** Entidade de endpoint (resposta) — sem hash do token, sem id de credencial. */
export const webhookEndpoint = z.object({
  id: webhookEndpointId,
  organizationId,
  connectionId,
  key: z.string().min(1).max(80),
  status: webhookEndpointStatus,
  signatureScheme: webhookSignatureScheme,
  /** `false` só quando o scheme é NONE e a insegurança foi reconhecida. */
  signatureRequired: z.boolean(),
  replayWindowSeconds: z.number().int().min(0).max(86_400),
  allowedEventTypes: z.array(eventType).max(100),
  operationId: operationId.nullable(),
  operationVersionId: operationVersionId.nullable(),
  createdByUserId: userId,
  revision: z.number().int().min(0),
  createdAt: isoUtcDateTime,
  updatedAt: isoUtcDateTime,
});
export type WebhookEndpoint = z.infer<typeof webhookEndpoint>;

// ── Requests ────────────────────────────────────────────────────────────────────
export const createWebhookEndpointRequest = z
  .object({
    connectionId,
    key: z.string().min(1).max(80),
    signatureScheme: webhookSignatureScheme.default('HMAC_SHA256'),
    /** Obrigatório `true` para aceitar scheme NONE (sem assinatura). */
    allowInsecureNoSignature: z.boolean().optional(),
    replayWindowSeconds: z.number().int().min(0).max(86_400).default(300),
    allowedEventTypes: z.array(eventType).max(100).optional(),
    operationId: operationId.optional(),
    operationVersionId: operationVersionId.optional(),
    /** Segredo de assinatura fornecido pelo provedor externo (write-only, opcional). */
    signingSecret: z.string().min(1).max(400).optional(),
  })
  .superRefine((body, ctx) => {
    if (body.signatureScheme === 'NONE' && body.allowInsecureNoSignature !== true) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['allowInsecureNoSignature'],
        message: 'signatureScheme=NONE exige allowInsecureNoSignature=true (não é default).',
      });
    }
  });
export type CreateWebhookEndpointRequest = z.infer<typeof createWebhookEndpointRequest>;

export const updateWebhookEndpointRequest = z.object({
  key: z.string().min(1).max(80).optional(),
  replayWindowSeconds: z.number().int().min(0).max(86_400).optional(),
  allowedEventTypes: z.array(eventType).max(100).optional(),
  operationId: operationId.nullable().optional(),
  operationVersionId: operationVersionId.nullable().optional(),
  expectedRevision: z.number().int().min(0),
});
export type UpdateWebhookEndpointRequest = z.infer<typeof updateWebhookEndpointRequest>;

export const webhookCommandRequest = z.object({
  expectedRevision: z.number().int().min(0),
  reason: z.string().max(400).optional(),
});
export type WebhookCommandRequest = z.infer<typeof webhookCommandRequest>;

/**
 * Resposta ÚNICA (write-once) da criação: inclui o token do endpoint e (quando
 * gerado pelo backend) o segredo de assinatura. NÃO reaparece em respostas
 * posteriores. Campos marcados como somente-uma-vez.
 */
export const webhookEndpointSecret = z.object({
  endpoint: webhookEndpoint,
  /** URL pública de entrada (contém o token). Exibida UMA vez. */
  endpointUrl: z.string(),
  /**
   * Token público da URL de entrada. Exibido UMA vez; guardado só como hash. `null`
   * em replay idempotente da criação (o token NÃO é reexposto nem persistido).
   */
  endpointToken: z.string().nullable(),
  /** Segredo de assinatura (quando aplicável). Exibido UMA vez; `null` em replay. */
  signingSecret: z.string().nullable(),
});
export type WebhookEndpointSecret = z.infer<typeof webhookEndpointSecret>;

// ── Delivery (append-only) ──────────────────────────────────────────────────────
export const webhookDelivery = z.object({
  id: webhookDeliveryId,
  organizationId,
  webhookEndpointId,
  externalDeliveryId: z.string().nullable(),
  payloadHash: z.string(),
  status: webhookDeliveryStatus,
  receivedAt: isoUtcDateTime,
  processedAt: isoUtcDateTime.nullable(),
  correlationId,
  errorCode: z.string().nullable(),
  errorSummary: z.string().nullable(),
});
export type WebhookDelivery = z.infer<typeof webhookDelivery>;

export const listWebhookEndpointsQuery = z.object({
  status: webhookEndpointStatus.optional(),
  connectionId: connectionId.optional(),
  operationId: operationId.optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});
export type ListWebhookEndpointsQuery = z.infer<typeof listWebhookEndpointsQuery>;

export const listWebhookDeliveriesQuery = z.object({
  status: webhookDeliveryStatus.optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});
export type ListWebhookDeliveriesQuery = z.infer<typeof listWebhookDeliveriesQuery>;

/** Resposta pública MÍNIMA do recebimento (sem detalhe interno de configuração). */
export const inboundWebhookAcceptedResponse = z.object({
  accepted: z.boolean(),
  status: z.enum(['accepted', 'replayed']),
  correlationId,
  deliveryId: webhookDeliveryId.nullable(),
});
export type InboundWebhookAcceptedResponse = z.infer<typeof inboundWebhookAcceptedResponse>;
