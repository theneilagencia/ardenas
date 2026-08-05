/**
 * Arden.AS API — endpoints administrativos de webhook (ARDEN-BE-006.7).
 *
 * Controllers FINOS: autenticação + tenant + permissão + idempotência + revision +
 * state machine + auditoria. O token do endpoint é retornado UMA única vez na criação
 * (nunca em GET/list/update). Sem endpoint de execução direta.
 */

import { Body, Controller, Get, Headers, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import {
  createWebhookEndpointRequest, updateWebhookEndpointRequest, webhookCommandRequest, listWebhookEndpointsQuery,
  type CreateWebhookEndpointRequest, type UpdateWebhookEndpointRequest, type WebhookCommandRequest, type ListWebhookEndpointsQuery,
} from '@arden/contracts';
import { RequireOrganization, RequirePermission } from '../../authz/decorators';
import { CurrentContext, type AuthenticatedRequestContext } from '../../identity/request-context';
import { ZodValidationPipe } from '../../common/validation/zod-validation.pipe';
import { requireIdempotencyKey } from '../../operations/request-headers';
import { WebhooksService } from './webhooks.service';

@Controller('organizations/:organizationId/webhook-endpoints')
export class WebhooksController {
  constructor(private readonly webhooks: WebhooksService) {}

  @Get()
  @RequireOrganization()
  @RequirePermission('webhook.view')
  list(@Query(new ZodValidationPipe(listWebhookEndpointsQuery)) query: ListWebhookEndpointsQuery, @CurrentContext() ctx: AuthenticatedRequestContext) {
    return this.webhooks.listEndpoints(ctx, query);
  }

  @Post()
  @HttpCode(201)
  @RequireOrganization()
  @RequirePermission('webhook.manage')
  async create(
    @Body(new ZodValidationPipe(createWebhookEndpointRequest)) body: CreateWebhookEndpointRequest,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @CurrentContext() ctx: AuthenticatedRequestContext,
  ) {
    const result = await this.webhooks.createEndpoint(ctx, body, requireIdempotencyKey(idempotencyKey));
    return result.body;
  }

  @Get(':webhookEndpointId')
  @RequireOrganization()
  @RequirePermission('webhook.view')
  get(@Param('webhookEndpointId') id: string, @CurrentContext() ctx: AuthenticatedRequestContext) {
    return this.webhooks.getEndpoint(ctx, id);
  }

  @Patch(':webhookEndpointId')
  @RequireOrganization()
  @RequirePermission('webhook.manage')
  update(
    @Param('webhookEndpointId') id: string,
    @Body(new ZodValidationPipe(updateWebhookEndpointRequest)) body: UpdateWebhookEndpointRequest,
    @CurrentContext() ctx: AuthenticatedRequestContext,
  ) {
    return this.webhooks.updateEndpoint(ctx, id, body);
  }

  @Post(':webhookEndpointId/suspend')
  @HttpCode(200)
  @RequireOrganization()
  @RequirePermission('webhook.manage')
  suspend(@Param('webhookEndpointId') id: string, @Body(new ZodValidationPipe(webhookCommandRequest)) body: WebhookCommandRequest, @CurrentContext() ctx: AuthenticatedRequestContext) {
    return this.webhooks.transitionEndpoint(ctx, id, 'SUSPENDED', body.expectedRevision, body.reason);
  }

  @Post(':webhookEndpointId/reactivate')
  @HttpCode(200)
  @RequireOrganization()
  @RequirePermission('webhook.manage')
  reactivate(@Param('webhookEndpointId') id: string, @Body(new ZodValidationPipe(webhookCommandRequest)) body: WebhookCommandRequest, @CurrentContext() ctx: AuthenticatedRequestContext) {
    return this.webhooks.transitionEndpoint(ctx, id, 'ACTIVE', body.expectedRevision, body.reason);
  }

  @Post(':webhookEndpointId/revoke')
  @HttpCode(200)
  @RequireOrganization()
  @RequirePermission('webhook.manage')
  revoke(@Param('webhookEndpointId') id: string, @Body(new ZodValidationPipe(webhookCommandRequest)) body: WebhookCommandRequest, @CurrentContext() ctx: AuthenticatedRequestContext) {
    return this.webhooks.transitionEndpoint(ctx, id, 'REVOKED', body.expectedRevision, body.reason);
  }
}
