/**
 * Arden.AS API — serviço de persistência de webhooks (ARDEN-BE-006.3).
 *
 * Endpoints e entregas TENANT-SCOPED, com máquina de estados, revision, idempotência
 * e auditoria. O token do endpoint é gerado e guardado SÓ como hash (verificador,
 * não segredo recuperável); o valor é retornado UMA única vez na criação. Assinatura,
 * janela de replay e recebimento público FUNCIONAIS ficam para 006.7 — aqui é
 * persistência: a deduplicação por external_delivery_id é garantida por constraint.
 */

import { Injectable } from '@nestjs/common';
import { randomBytes, createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import {
  type CreateWebhookEndpointRequest, type UpdateWebhookEndpointRequest,
  type WebhookEndpoint, type WebhookEndpointSecret, type WebhookDelivery,
  type WebhookEndpointStatus, type WebhookDeliveryStatus,
} from '@arden/contracts';
import { PrismaService } from '../../database/prisma.service';
import { IdempotencyService } from '../../modules/idempotency/idempotency.service';
import { AuditRecorder } from '../../audit/audit.recorder';
import { runIdempotentCommand } from '../../operations/command.helpers';
import { assertRevision } from '../../common/concurrency/optimistic-concurrency';
import type { AuthenticatedRequestContext } from '../../identity/request-context';
import { notFound, connectionRevoked, invalidStateTransition, webhookEndpointRevoked, versionConflict, resourceConflict } from '../../common/errors/api-error';
import { OrganizationConnectionsRepository } from '../connections/connections.repository';
import { WebhookEndpointsRepository, WebhookDeliveriesRepository } from './webhooks.repository';
import { canTransitionWebhookEndpoint, canTransitionWebhookDelivery } from '../connector.state-machines';
import { toWebhookEndpointContract, toWebhookDeliveryContract } from '../connectors.serializers';

const ENDPOINT_TRANSITION_AUDIT: Record<Exclude<WebhookEndpointStatus, 'ACTIVE'> | 'ACTIVE', string> = {
  ACTIVE: 'webhook_endpoint.reactivated',
  SUSPENDED: 'webhook_endpoint.suspended',
  REVOKED: 'webhook_endpoint.revoked',
};

const DELIVERY_TRANSITION_AUDIT: Record<WebhookDeliveryStatus, string> = {
  RECEIVED: 'webhook_delivery.received',
  ACCEPTED: 'webhook_delivery.accepted',
  REJECTED: 'webhook_delivery.rejected',
  REPLAYED: 'webhook_delivery.replayed',
  PROCESSED: 'webhook_delivery.processed',
  FAILED: 'webhook_delivery.failed',
};

@Injectable()
export class WebhooksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly connections: OrganizationConnectionsRepository,
    private readonly endpoints: WebhookEndpointsRepository,
    private readonly deliveries: WebhookDeliveriesRepository,
    private readonly idem: IdempotencyService,
    private readonly audit: AuditRecorder,
  ) {}

  private orgId(ctx: AuthenticatedRequestContext): string {
    return ctx.organizationId as string;
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  // ── Endpoints ─────────────────────────────────────────────────────────────────
  async createEndpoint(ctx: AuthenticatedRequestContext, body: CreateWebhookEndpointRequest, idempotencyKey: string): Promise<{ statusCode: number; body: { data: WebhookEndpointSecret } }> {
    const orgId = this.orgId(ctx);
    // Token: gerado aqui, guardado SÓ como hash; devolvido uma única vez.
    const token = randomBytes(32).toString('base64url');
    const pathTokenHash = this.hashToken(token);

    const result = await runIdempotentCommand<{ data: WebhookEndpointSecret }>(
      { idem: this.idem, prisma: this.prisma },
      { method: 'POST', path: `/organizations/${orgId}/webhook-endpoints`, idempotencyKey, userId: ctx.userId, organizationId: orgId },
      body, 201,
      async (tx) => {
        const conn = await this.connections.findById(orgId, body.connectionId, tx);
        if (!conn) throw notFound('Conexão não encontrada.');
        if (conn.status === 'REVOKED') throw connectionRevoked();
        if (body.operationId) {
          const op = await tx.operation.findFirst({ where: { id: body.operationId, organizationId: orgId } });
          if (!op) throw notFound('Operação não encontrada.');
          if (body.operationVersionId) {
            const ver = await tx.operationVersion.findFirst({ where: { id: body.operationVersionId, organizationId: orgId, operationId: body.operationId } });
            if (!ver) throw notFound('Versão não pertence à operação.');
          }
        }
        const created = await this.endpoints.create({
          organizationId: orgId, connectionId: body.connectionId, key: body.key, status: 'ACTIVE',
          pathTokenHash, signatureScheme: body.signatureScheme,
          replayWindowSeconds: body.replayWindowSeconds, allowedEventTypes: (body.allowedEventTypes ?? []) as Prisma.InputJsonValue,
          operationId: body.operationId ?? null, operationVersionId: body.operationVersionId ?? null,
          createdByUserId: ctx.userId, revision: 1,
        }, tx);
        await this.audit.record(tx, { organizationId: orgId, actorUserId: ctx.userId, action: 'webhook_endpoint.created', resourceType: 'webhook_endpoint', resourceId: created.id, correlationId: ctx.correlationId, after: { key: created.key, signatureScheme: created.signatureScheme }, metadata: {} });
        // signingSecret fica para 006.4/006.7 (cofre); não persistimos segredo aqui.
        return { data: { endpoint: toWebhookEndpointContract(created), endpointToken: token, signingSecret: null } };
      },
    );
    return { statusCode: result.statusCode, body: result.response };
  }

  async updateEndpoint(ctx: AuthenticatedRequestContext, id: string, body: UpdateWebhookEndpointRequest): Promise<{ data: WebhookEndpoint }> {
    const orgId = this.orgId(ctx);
    const fresh = await this.prisma.$transaction(async (tx) => {
      const current = await this.endpoints.findById(orgId, id, tx);
      if (!current) throw notFound('Endpoint não encontrado.');
      if (current.status === 'REVOKED') throw webhookEndpointRevoked();
      assertRevision({ resourceType: 'webhook_endpoint', resourceId: id, expectedRevision: body.expectedRevision, currentRevision: current.revision });
      const data: Prisma.WebhookEndpointUncheckedUpdateInput = {};
      if (body.key !== undefined) data.key = body.key;
      if (body.replayWindowSeconds !== undefined) data.replayWindowSeconds = body.replayWindowSeconds;
      if (body.allowedEventTypes !== undefined) data.allowedEventTypes = body.allowedEventTypes as Prisma.InputJsonValue;
      if (body.operationId !== undefined) data.operationId = body.operationId;
      if (body.operationVersionId !== undefined) data.operationVersionId = body.operationVersionId;
      const count = await this.endpoints.updateGuarded(orgId, id, body.expectedRevision, data, tx);
      if (count === 0) throw versionConflict({ resourceType: 'webhook_endpoint', resourceId: id, expectedRevision: body.expectedRevision, currentRevision: current.revision });
      await this.audit.record(tx, { organizationId: orgId, actorUserId: ctx.userId, action: 'webhook_endpoint.updated', resourceType: 'webhook_endpoint', resourceId: id, correlationId: ctx.correlationId, metadata: {} });
      return (await this.endpoints.findById(orgId, id, tx))!;
    });
    return { data: toWebhookEndpointContract(fresh) };
  }

  async transitionEndpoint(ctx: AuthenticatedRequestContext, id: string, target: WebhookEndpointStatus, expectedRevision: number, reason?: string): Promise<{ data: WebhookEndpoint }> {
    const orgId = this.orgId(ctx);
    const fresh = await this.prisma.$transaction(async (tx) => {
      const current = await this.endpoints.findById(orgId, id, tx);
      if (!current) throw notFound('Endpoint não encontrado.');
      if (current.status === 'REVOKED') throw webhookEndpointRevoked();
      assertRevision({ resourceType: 'webhook_endpoint', resourceId: id, expectedRevision, currentRevision: current.revision });
      if (!canTransitionWebhookEndpoint(current.status, target)) throw invalidStateTransition(`Transição inválida ${current.status} → ${target}.`);
      const count = await this.endpoints.updateGuarded(orgId, id, expectedRevision, { status: target }, tx);
      if (count === 0) throw versionConflict({ resourceType: 'webhook_endpoint', resourceId: id, expectedRevision, currentRevision: current.revision });
      await this.audit.record(tx, { organizationId: orgId, actorUserId: ctx.userId, action: ENDPOINT_TRANSITION_AUDIT[target], resourceType: 'webhook_endpoint', resourceId: id, correlationId: ctx.correlationId, before: { status: current.status }, after: { status: target }, metadata: reason ? { reason } : {} });
      return (await this.endpoints.findById(orgId, id, tx))!;
    });
    return { data: toWebhookEndpointContract(fresh) };
  }

  // ── Deliveries (append-oriented) ───────────────────────────────────────────────
  /** Registra uma entrega RECEIVED. Dedup por external_delivery_id via constraint. */
  async recordDelivery(
    ctx: AuthenticatedRequestContext,
    webhookEndpointId: string,
    input: { externalDeliveryId: string | null; payloadHash: string },
  ): Promise<{ data: WebhookDelivery; deduplicated: boolean }> {
    const orgId = this.orgId(ctx);
    const endpoint = await this.endpoints.findById(orgId, webhookEndpointId);
    if (!endpoint) throw notFound('Endpoint não encontrado.');
    try {
      const row = await this.prisma.$transaction(async (tx) => {
        const created = await this.deliveries.create({
          organizationId: orgId, webhookEndpointId, externalDeliveryId: input.externalDeliveryId,
          payloadHash: input.payloadHash, status: 'RECEIVED', correlationId: ctx.correlationId,
        }, tx);
        await this.audit.record(tx, { organizationId: orgId, actorUserId: ctx.userId, action: 'webhook_delivery.received', resourceType: 'webhook_delivery', resourceId: created.id, correlationId: ctx.correlationId, metadata: {} });
        return created;
      });
      return { data: toWebhookDeliveryContract(row), deduplicated: false };
    } catch (err) {
      // Duplicata por external_delivery_id (constraint) → retorna a entrega existente.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002' && input.externalDeliveryId) {
        const existing = await this.deliveries.findByExternalDeliveryId(orgId, webhookEndpointId, input.externalDeliveryId);
        if (existing) return { data: toWebhookDeliveryContract(existing), deduplicated: true };
      }
      throw err;
    }
  }

  async transitionDelivery(ctx: AuthenticatedRequestContext, id: string, target: WebhookDeliveryStatus): Promise<{ data: WebhookDelivery }> {
    const orgId = this.orgId(ctx);
    const fresh = await this.prisma.$transaction(async (tx) => {
      const current = await this.deliveries.findById(orgId, id, tx);
      if (!current) throw notFound('Entrega não encontrada.');
      if (!canTransitionWebhookDelivery(current.status, target)) throw invalidStateTransition(`Transição inválida ${current.status} → ${target}.`);
      const data: Prisma.WebhookDeliveryUncheckedUpdateInput = { status: target };
      if (target === 'PROCESSED' || target === 'FAILED') data.processedAt = new Date();
      const count = await this.deliveries.transition(orgId, id, current.status, data, tx);
      if (count === 0) throw resourceConflict('Transição de entrega concorrente.');
      await this.audit.record(tx, { organizationId: orgId, actorUserId: ctx.userId, action: DELIVERY_TRANSITION_AUDIT[target], resourceType: 'webhook_delivery', resourceId: id, correlationId: ctx.correlationId, before: { status: current.status }, after: { status: target }, metadata: {} });
      return (await this.deliveries.findById(orgId, id, tx))!;
    });
    return { data: toWebhookDeliveryContract(fresh) };
  }
}
