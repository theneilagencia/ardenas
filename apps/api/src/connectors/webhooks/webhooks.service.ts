/**
 * Arden.AS API — serviço de persistência de webhooks (ARDEN-BE-006.3).
 *
 * Endpoints e entregas TENANT-SCOPED, com máquina de estados, revision, idempotência
 * e auditoria. O token do endpoint é gerado e guardado SÓ como hash (verificador,
 * não segredo recuperável); o valor é retornado UMA única vez na criação. Assinatura,
 * janela de replay e recebimento público FUNCIONAIS ficam para 006.7 — aqui é
 * persistência: a deduplicação por external_delivery_id é garantida por constraint.
 */

import { Inject, Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { Prisma } from '@prisma/client';
import {
  type CreateWebhookEndpointRequest, type UpdateWebhookEndpointRequest,
  type WebhookEndpoint, type WebhookEndpointSecret, type WebhookDelivery,
  type WebhookEndpointStatus, type WebhookDeliveryStatus,
  type ListWebhookEndpointsQuery, type PaginationMeta,
} from '@arden/contracts';
import { PrismaService } from '../../database/prisma.service';
import { IdempotencyService } from '../../modules/idempotency/idempotency.service';
import { AuditRecorder } from '../../audit/audit.recorder';
import { runIdempotentCommand } from '../../operations/command.helpers';
import { assertRevision } from '../../common/concurrency/optimistic-concurrency';
import type { AuthenticatedRequestContext } from '../../identity/request-context';
import { AppConfig } from '../../config/env.schema';
import { APP_CONFIG } from '../../config/config.module';
import { notFound, connectionRevoked, invalidStateTransition, webhookEndpointRevoked, versionConflict, resourceConflict, validationError } from '../../common/errors/api-error';
import { OrganizationConnectionsRepository, ConnectionCredentialVersionsRepository } from '../connections/connections.repository';
import { ConnectorKeyProvider } from '../vault/connector-key-provider';
import { SECRET_VAULT, type SecretVault } from '../vault/secret-vault';
import { WebhookEndpointsRepository, WebhookDeliveriesRepository } from './webhooks.repository';
import { generateEndpointToken, hashEndpointToken } from './webhook-token';
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
    private readonly credentials: ConnectionCredentialVersionsRepository,
    private readonly endpoints: WebhookEndpointsRepository,
    private readonly deliveries: WebhookDeliveriesRepository,
    private readonly idem: IdempotencyService,
    private readonly audit: AuditRecorder,
    private readonly keys: ConnectorKeyProvider,
    @Inject(SECRET_VAULT) private readonly vault: SecretVault,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  private orgId(ctx: AuthenticatedRequestContext): string {
    return ctx.organizationId as string;
  }

  // ── Leitura ─────────────────────────────────────────────────────────────────────
  async listEndpoints(ctx: AuthenticatedRequestContext, query: ListWebhookEndpointsQuery): Promise<{ data: WebhookEndpoint[]; pagination: PaginationMeta }> {
    const orgId = this.orgId(ctx);
    const rows = await this.endpoints.list(orgId, { status: query.status, connectionId: query.connectionId, operationId: query.operationId }, query.limit + 1, query.cursor);
    const hasNextPage = rows.length > query.limit;
    const page = hasNextPage ? rows.slice(0, query.limit) : rows;
    const last = page[page.length - 1];
    return { data: page.map(toWebhookEndpointContract), pagination: { cursor: query.cursor ?? null, nextCursor: hasNextPage && last ? last.createdAt.toISOString() : null, hasNextPage, limit: query.limit } };
  }

  async getEndpoint(ctx: AuthenticatedRequestContext, id: string): Promise<{ data: WebhookEndpoint }> {
    const orgId = this.orgId(ctx);
    const row = await this.endpoints.findById(orgId, id);
    if (!row) throw notFound('Endpoint não encontrado.');
    return { data: toWebhookEndpointContract(row) };
  }

  // ── Endpoints ─────────────────────────────────────────────────────────────────
  async createEndpoint(ctx: AuthenticatedRequestContext, body: CreateWebhookEndpointRequest, idempotencyKey: string): Promise<{ statusCode: number; body: { data: WebhookEndpointSecret } }> {
    const orgId = this.orgId(ctx);
    // NONE só fora de produção e com reconhecimento explícito (nunca default).
    if (body.signatureScheme === 'NONE' && this.config.NODE_ENV === 'production') {
      throw validationError([{ field: 'signatureScheme', code: 'forbidden', message: 'signatureScheme=NONE é proibido em produção.' }]);
    }
    const requiresSecret = body.signatureScheme !== 'NONE';
    // Token opaco e (quando aplicável) segredo de assinatura: gerados aqui, exibidos
    // UMA vez; token guardado só como hash; segredo cifrado no cofre. NUNCA persistidos
    // em idempotency_records (a resposta armazenada é SANITIZADA, sem token/segredo).
    const token = generateEndpointToken();
    const pathTokenHash = hashEndpointToken(token);
    const signingSecret = requiresSecret ? (body.signingSecret ?? randomBytes(32).toString('base64url')) : null;
    const keyVersion = requiresSecret ? this.keys.getCurrentKey().version : null;

    const result = await runIdempotentCommand<{ data: WebhookEndpoint }>(
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

        // Segredo de assinatura → versão de credencial cifrada no cofre (mesma tx).
        let secretCredentialVersionId: string | null = null;
        if (requiresSecret && signingSecret && keyVersion) {
          const versionNumber = await this.credentials.nextVersionNumber(body.connectionId, tx);
          const pending = await this.credentials.createPending({ organizationId: orgId, connectionId: body.connectionId, versionNumber, createdByUserId: ctx.userId }, tx);
          await this.vault.storeSecret({ organizationId: orgId, connectionId: body.connectionId, credentialVersionId: pending.id, keyVersion, secret: { signingSecret } }, tx);
          const prior = await this.credentials.findActive(orgId, body.connectionId, tx);
          if (prior && prior.id !== pending.id) await this.credentials.supersede(orgId, prior.id, new Date(), tx);
          await this.credentials.activate(orgId, pending.id, new Date(), tx);
          await this.connections.setCurrentCredential(orgId, body.connectionId, pending.id, tx);
          secretCredentialVersionId = pending.id;
        }

        const created = await this.endpoints.create({
          organizationId: orgId, connectionId: body.connectionId, key: body.key, status: 'ACTIVE',
          pathTokenHash, signatureScheme: body.signatureScheme, secretCredentialVersionId,
          replayWindowSeconds: body.replayWindowSeconds, allowedEventTypes: (body.allowedEventTypes ?? []) as Prisma.InputJsonValue,
          operationId: body.operationId ?? null, operationVersionId: body.operationVersionId ?? null,
          createdByUserId: ctx.userId, revision: 1,
        }, tx);
        await this.audit.record(tx, { organizationId: orgId, actorUserId: ctx.userId, action: 'webhook_endpoint.created', resourceType: 'webhook_endpoint', resourceId: created.id, correlationId: ctx.correlationId, after: { key: created.key, signatureScheme: created.signatureScheme }, metadata: {} });
        // Resposta ARMAZENADA na idempotência = SANITIZADA (sem token/segredo).
        return { data: toWebhookEndpointContract(created) };
      },
    );

    // Token/segredo só na PRIMEIRA execução (nunca em replay; nunca persistidos em claro).
    const endpoint = result.response.data;
    const publicUrl = `${this.config.API_PREFIX}/webhooks/${token}`;
    const secret: WebhookEndpointSecret = result.replayed
      ? { endpoint, endpointUrl: '', endpointToken: null, signingSecret: null }
      : { endpoint, endpointUrl: publicUrl, endpointToken: token, signingSecret: body.signatureScheme === 'NONE' ? null : signingSecret };
    return { statusCode: result.statusCode, body: { data: secret } };
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
