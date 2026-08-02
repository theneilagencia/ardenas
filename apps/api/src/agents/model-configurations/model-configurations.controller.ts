/**
 * Arden.AS API — controller de configurações de modelo (ARDEN-BE-007.2).
 * Tenant no path; response nunca inclui credencial. Idempotência/concorrência por contrato.
 */

import { Body, Controller, Get, Headers, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import {
  createModelConfigurationRequest,
  updateModelConfigurationRequest,
  modelConfigurationCommandRequest,
  listModelConfigurationsQuery,
  type CreateModelConfigurationRequest,
  type UpdateModelConfigurationRequest,
  type ModelConfigurationCommandRequest,
  type ListModelConfigurationsQuery,
} from '@arden/contracts';
import { RequireOrganization, RequirePermission } from '../../authz/decorators';
import { CurrentContext, type AuthenticatedRequestContext } from '../../identity/request-context';
import { ZodValidationPipe } from '../../common/validation/zod-validation.pipe';
import { requireIdempotencyKey } from '../../operations/request-headers';
import { ModelConfigurationsService } from './model-configurations.service';

@Controller('organizations/:organizationId/model-configurations')
export class ModelConfigurationsController {
  constructor(private readonly configs: ModelConfigurationsService) {}

  @Get()
  @RequireOrganization()
  @RequirePermission('model_configuration.view')
  async list(
    @Query(new ZodValidationPipe(listModelConfigurationsQuery)) query: ListModelConfigurationsQuery,
    @CurrentContext() ctx: AuthenticatedRequestContext,
  ) {
    const res = await this.configs.list(ctx, { providerKey: query.providerKey, status: query.status, modelId: query.modelId, search: query.search }, query.limit, query.cursor);
    return { data: res.data, pagination: { cursor: query.cursor ?? null, nextCursor: res.nextCursor, hasNextPage: res.nextCursor !== null, limit: query.limit } };
  }

  @Post()
  @HttpCode(201)
  @RequireOrganization()
  @RequirePermission('model_configuration.create')
  async create(
    @Body(new ZodValidationPipe(createModelConfigurationRequest)) body: CreateModelConfigurationRequest,
    @Headers('idempotency-key') key: string | undefined,
    @CurrentContext() ctx: AuthenticatedRequestContext,
  ) {
    return (await this.configs.create(ctx, body, requireIdempotencyKey(key))).body;
  }

  @Get(':configurationId')
  @RequireOrganization()
  @RequirePermission('model_configuration.view')
  get(@Param('configurationId') configurationId: string, @CurrentContext() ctx: AuthenticatedRequestContext) {
    return this.configs.get(ctx, configurationId);
  }

  @Patch(':configurationId')
  @RequireOrganization()
  @RequirePermission('model_configuration.edit')
  update(
    @Param('configurationId') configurationId: string,
    @Body(new ZodValidationPipe(updateModelConfigurationRequest)) body: UpdateModelConfigurationRequest,
    @CurrentContext() ctx: AuthenticatedRequestContext,
  ) {
    return this.configs.update(ctx, configurationId, body);
  }

  @Post(':configurationId/activate')
  @HttpCode(200)
  @RequireOrganization()
  @RequirePermission('model_configuration.edit')
  activate(
    @Param('configurationId') configurationId: string,
    @Body(new ZodValidationPipe(modelConfigurationCommandRequest)) body: ModelConfigurationCommandRequest,
    @CurrentContext() ctx: AuthenticatedRequestContext,
  ) {
    return this.configs.transitionStatus(ctx, configurationId, 'ACTIVE', 'model_configuration.activated', body.expectedRevision, body.reason);
  }

  @Post(':configurationId/suspend')
  @HttpCode(200)
  @RequireOrganization()
  @RequirePermission('model_configuration.edit')
  suspend(
    @Param('configurationId') configurationId: string,
    @Body(new ZodValidationPipe(modelConfigurationCommandRequest)) body: ModelConfigurationCommandRequest,
    @CurrentContext() ctx: AuthenticatedRequestContext,
  ) {
    return this.configs.transitionStatus(ctx, configurationId, 'SUSPENDED', 'model_configuration.suspended', body.expectedRevision, body.reason);
  }

  @Post(':configurationId/revoke')
  @HttpCode(200)
  @RequireOrganization()
  @RequirePermission('model_configuration.revoke')
  revoke(
    @Param('configurationId') configurationId: string,
    @Body(new ZodValidationPipe(modelConfigurationCommandRequest)) body: ModelConfigurationCommandRequest,
    @CurrentContext() ctx: AuthenticatedRequestContext,
  ) {
    return this.configs.transitionStatus(ctx, configurationId, 'REVOKED', 'model_configuration.revoked', body.expectedRevision, body.reason);
  }
}
