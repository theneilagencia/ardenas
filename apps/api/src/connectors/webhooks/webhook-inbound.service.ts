/**
 * Arden.AS API — pipeline de webhook de ENTRADA (ARDEN-BE-006.7).
 *
 * Fino no controller; toda a lógica aqui. Fluxo: lookup por hash → validação do
 * endpoint → assinatura (raw body, constant-time) → timestamp → replay → persistência
 * da delivery → resolução do tenant/operação → criação IDEMPOTENTE da execução pelo
 * motor do BE-005 → auditoria/evidência sanitizadas. Tenant vem SEMPRE do endpoint
 * persistido, NUNCA do request. Segredo resolvido no servidor, nunca logado/persistido
 * fora do cofre. Resposta pública mínima.
 */

import { Inject, Injectable } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import type { WebhookEndpoint as DbWebhookEndpoint } from '@prisma/client';
import type { InboundWebhookAcceptedResponse } from '@arden/contracts';
import { AppConfig } from '../../config/env.schema';
import { APP_CONFIG } from '../../config/config.module';
import { PrismaService } from '../../database/prisma.service';
import { AuditRecorder } from '../../audit/audit.recorder';
import type { AuthenticatedRequestContext } from '../../identity/request-context';
import {
  notFound, requestTooLarge, rateLimited, webhookEndpointRevoked, webhookEndpointSuspended,
  webhookSignatureInvalid, webhookTimestampInvalid, webhookEventNotAllowed, webhookDeliveryConflict, ApiException,
} from '../../common/errors/api-error';
import { ExecutionsService } from '../../executions/executions.service';
import { CredentialResolver } from '../vault/credential-resolver';
import { WebhookEndpointsRepository, WebhookDeliveriesRepository } from './webhooks.repository';
import { WebhooksService } from './webhooks.service';
import { WebhookRateLimiter } from './webhook-rate-limiter';
import { hashEndpointToken } from './webhook-token';
import { validateTimestamp, verifyHmacSignature, verifyStaticBearer } from './webhook-signature';

const MAX_PAYLOAD_BYTES = 256 * 1024;

type Headers = Record<string, string | string[] | undefined>;

/** Header single-value; array (ambíguo) ⇒ undefined (rejeitado a montante). */
function single(headers: Headers, name: string): string | undefined {
  const v = headers[name];
  if (Array.isArray(v)) return undefined;
  return v;
}

@Injectable()
export class WebhookInboundService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly endpoints: WebhookEndpointsRepository,
    private readonly deliveries: WebhookDeliveriesRepository,
    private readonly webhooks: WebhooksService,
    private readonly credentials: CredentialResolver,
    private readonly executions: ExecutionsService,
    private readonly audit: AuditRecorder,
    private readonly rateLimiter: WebhookRateLimiter,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async receive(token: string, rawBody: Buffer, headers: Headers, ip: string, now = new Date()): Promise<InboundWebhookAcceptedResponse> {
    const tokenHash = hashEndpointToken(token);
    if (!this.rateLimiter.check(tokenHash, ip)) throw rateLimited();

    const endpoint = await this.endpoints.findByPathTokenHash(tokenHash);
    // Token inválido é indistinguível de endpoint inexistente (resposta pública mínima).
    if (!endpoint) throw notFound('Recurso não encontrado.');

    const orgId = endpoint.organizationId;
    const correlationId = single(headers, 'x-correlation-id') ?? randomUUID();
    const sysCtx = { organizationId: orgId, userId: endpoint.createdByUserId, correlationId } as unknown as AuthenticatedRequestContext;

    try {
      if (endpoint.status === 'REVOKED') throw webhookEndpointRevoked();
      if (endpoint.status === 'SUSPENDED') throw webhookEndpointSuspended();
      if (rawBody.length > MAX_PAYLOAD_BYTES) throw requestTooLarge();

      const timestamp = single(headers, 'x-arden-timestamp');
      const signature = single(headers, 'x-arden-signature');
      const externalDeliveryId = single(headers, 'x-arden-delivery-id') ?? null;
      const eventType = single(headers, 'x-arden-event-type');
      const authorization = single(headers, 'authorization');

      // ── Autenticação (antes de qualquer persistência) ──────────────────────────
      await this.authenticate(endpoint, orgId, rawBody, { timestamp, signature, authorization }, now, sysCtx);
      await this.recordAudit(orgId, 'webhook.signature_validated', endpoint.id, correlationId, { scheme: endpoint.signatureScheme });

      // ── Event type allowlist ────────────────────────────────────────────────────
      const allowed = Array.isArray(endpoint.allowedEventTypes) ? (endpoint.allowedEventTypes as string[]) : [];
      if (allowed.length > 0 && (!eventType || !allowed.includes(eventType))) {
        await this.recordAudit(orgId, 'webhook.event_rejected', endpoint.id, correlationId, { eventType: eventType ?? null });
        throw webhookEventNotAllowed();
      }

      const payloadHash = createHash('sha256').update(rawBody).digest('hex');

      // ── Replay + persistência da delivery ───────────────────────────────────────
      const replay = await this.resolveReplay(sysCtx, endpoint, externalDeliveryId, payloadHash, now);
      if (replay.kind === 'replayed') {
        await this.recordAudit(orgId, 'webhook.replayed', replay.deliveryId, correlationId, { payloadHash });
        return { accepted: true, status: 'replayed', correlationId, deliveryId: replay.deliveryId };
      }
      if (replay.kind === 'conflict') {
        await this.recordAudit(orgId, 'webhook.failed', replay.deliveryId, correlationId, { reason: 'delivery_conflict' });
        throw webhookDeliveryConflict();
      }
      const deliveryId = replay.deliveryId;
      await this.webhooks.transitionDelivery(sysCtx, deliveryId, 'ACCEPTED');
      await this.recordAudit(orgId, 'webhook.accepted', deliveryId, correlationId, { eventType: eventType ?? null });

      // ── Trigger + execução (motor BE-005) ───────────────────────────────────────
      if (endpoint.operationId) {
        await this.triggerExecution(endpoint, orgId, deliveryId, eventType ?? null, rawBody, payloadHash, externalDeliveryId, timestamp ?? null, correlationId, sysCtx);
      }

      return { accepted: true, status: 'accepted', correlationId, deliveryId };
    } catch (err) {
      // Falhas de autenticação/validação: auditadas (sem segredo), resposta genérica.
      if (err instanceof ApiException) {
        await this.recordAudit(orgId, this.rejectionAction(err.code), endpoint.id, correlationId, { code: err.code }).catch(() => undefined);
      }
      throw err;
    }
  }

  private rejectionAction(code: string): string {
    if (code === 'WEBHOOK_SIGNATURE_INVALID') return 'webhook.signature_rejected';
    if (code === 'WEBHOOK_TIMESTAMP_INVALID') return 'webhook.timestamp_rejected';
    if (code === 'WEBHOOK_EVENT_NOT_ALLOWED') return 'webhook.event_rejected';
    return 'webhook.failed';
  }

  // ── Autenticação por scheme ─────────────────────────────────────────────────────
  private async authenticate(
    endpoint: DbWebhookEndpoint,
    orgId: string,
    rawBody: Buffer,
    h: { timestamp?: string; signature?: string; authorization?: string },
    now: Date,
    sysCtx: AuthenticatedRequestContext,
  ): Promise<void> {
    if (endpoint.signatureScheme === 'NONE') {
      // NONE nunca em produção (bloqueado também na criação).
      if (this.config.NODE_ENV === 'production') throw webhookSignatureInvalid();
      return;
    }
    const secret = await this.resolveSigningSecret(endpoint, orgId);

    if (endpoint.signatureScheme === 'HMAC_SHA256') {
      const ts = validateTimestamp(h.timestamp, now, endpoint.replayWindowSeconds);
      if (!ts.ok) {
        await this.recordAudit(orgId, 'webhook.timestamp_rejected', 'webhook', sysCtx.correlationId, { reason: ts.reason });
        throw webhookTimestampInvalid();
      }
      if (!h.timestamp || !verifyHmacSignature(rawBody, h.timestamp, h.signature, secret)) throw webhookSignatureInvalid();
      return;
    }
    if (endpoint.signatureScheme === 'STATIC_BEARER') {
      if (!verifyStaticBearer(h.authorization, secret)) throw webhookSignatureInvalid();
      return;
    }
    throw webhookSignatureInvalid();
  }

  private async resolveSigningSecret(endpoint: DbWebhookEndpoint, orgId: string): Promise<string> {
    if (!endpoint.secretCredentialVersionId) throw webhookSignatureInvalid();
    const resolved = await this.credentials.resolveCredentialVersion({ organizationId: orgId, connectionId: endpoint.connectionId, credentialVersionId: endpoint.secretCredentialVersionId });
    const secret = typeof resolved.secret.signingSecret === 'string' ? resolved.secret.signingSecret : '';
    // Descarta a referência ao objeto resolvido após extrair o valor.
    resolved.secret = {};
    if (!secret) throw webhookSignatureInvalid();
    return secret;
  }

  // ── Replay ────────────────────────────────────────────────────────────────────
  private async resolveReplay(
    sysCtx: AuthenticatedRequestContext,
    endpoint: DbWebhookEndpoint,
    externalDeliveryId: string | null,
    payloadHash: string,
    now: Date,
  ): Promise<{ kind: 'new' | 'replayed' | 'conflict'; deliveryId: string }> {
    const orgId = sysCtx.organizationId as string;
    // Sem delivery id: dedup por payloadHash dentro da janela de replay.
    if (!externalDeliveryId) {
      const windowStart = new Date(now.getTime() - endpoint.replayWindowSeconds * 1000);
      const recent = await this.prisma.webhookDelivery.findFirst({
        where: { organizationId: orgId, webhookEndpointId: endpoint.id, payloadHash, status: { in: ['ACCEPTED', 'PROCESSED'] }, receivedAt: { gt: windowStart } },
        orderBy: { receivedAt: 'desc' },
      });
      if (recent) return { kind: 'replayed', deliveryId: recent.id };
    } else {
      const existing = await this.deliveries.findByExternalDeliveryId(orgId, endpoint.id, externalDeliveryId);
      if (existing) {
        return existing.payloadHash === payloadHash
          ? { kind: 'replayed', deliveryId: existing.id }
          : { kind: 'conflict', deliveryId: existing.id };
      }
    }
    // Nova entrega (RECEIVED). A constraint única (endpoint, external_delivery_id)
    // serializa requests concorrentes com o MESMO delivery id → um vence, outro dedup.
    const recorded = await this.webhooks.recordDelivery(sysCtx, endpoint.id, { externalDeliveryId, payloadHash });
    if (recorded.deduplicated) {
      return recorded.data.payloadHash === payloadHash
        ? { kind: 'replayed', deliveryId: recorded.data.id }
        : { kind: 'conflict', deliveryId: recorded.data.id };
    }
    return { kind: 'new', deliveryId: recorded.data.id };
  }

  // ── Trigger de execução ─────────────────────────────────────────────────────────
  private async triggerExecution(
    endpoint: DbWebhookEndpoint,
    orgId: string,
    deliveryId: string,
    eventType: string | null,
    rawBody: Buffer,
    payloadHash: string,
    externalDeliveryId: string | null,
    timestamp: string | null,
    correlationId: string,
    sysCtx: AuthenticatedRequestContext,
  ): Promise<void> {
    let payload: unknown = {};
    try {
      payload = rawBody.length ? JSON.parse(rawBody.toString('utf8')) : {};
    } catch {
      payload = {};
    }
    const triggerEvidence = {
      webhookEndpointId: endpoint.id, webhookDeliveryId: deliveryId, eventType, payloadHash,
      payloadBytes: rawBody.length, signatureScheme: endpoint.signatureScheme, timestamp,
      externalDeliveryId, operationId: endpoint.operationId, correlationId,
    };
    try {
      const result = await this.executions.createFromSystemTrigger({
        organizationId: orgId, operationId: endpoint.operationId!, operationVersionId: endpoint.operationVersionId ?? undefined,
        payload, correlationId, requestedByUserId: endpoint.createdByUserId, triggerReference: deliveryId, triggerEvidence,
      });
      await this.recordAudit(orgId, 'webhook.trigger_created', deliveryId, correlationId, { eventType });
      await this.recordAudit(orgId, 'webhook.execution_created', result.run.id, correlationId, { operationId: endpoint.operationId, created: result.created });
      await this.webhooks.transitionDelivery(sysCtx, deliveryId, 'PROCESSED').catch(() => undefined);
    } catch (err) {
      // Trigger negado (ex.: exige aprovação): delivery ACEITA, mas sem execução.
      const code = err instanceof ApiException ? err.code : 'INTERNAL_ERROR';
      await this.recordAudit(orgId, 'webhook.execution_denied', deliveryId, correlationId, { code });
      if (!(err instanceof ApiException) || err.code !== 'WEBHOOK_TRIGGER_DENIED') throw err;
    }
  }

  private async recordAudit(organizationId: string, action: string, resourceId: string, correlationId: string, metadata: Record<string, unknown>): Promise<void> {
    await this.prisma.$transaction((tx) =>
      this.audit.record(tx, { organizationId, actorUserId: null, action, resourceType: 'webhook_delivery', resourceId, correlationId, metadata }),
    );
  }
}
