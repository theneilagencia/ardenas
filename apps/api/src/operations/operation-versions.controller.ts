/**
 * Arden.AS API — endpoints de versões de operação (ARDEN-BE-003). Controllers finos.
 */

import { Body, Controller, Get, Headers, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import {
  createOperationVersionRequest,
  updateOperationVersionRequest,
  publishOperationVersionRequest,
  cursorPageParams,
  type CreateOperationVersionRequest,
  type UpdateOperationVersionRequest,
  type PublishOperationVersionRequest,
} from '@arden/contracts';
import { RequireOrganization, RequirePermission } from '../authz/decorators';
import { CurrentContext, type AuthenticatedRequestContext } from '../identity/request-context';
import { ZodValidationPipe } from '../common/validation/zod-validation.pipe';
import {
  OperationVersionsService,
  type VersionEnvelope,
  type VersionListEnvelope,
} from './operation-versions.service';
import { requireIdempotencyKey } from './request-headers';

@Controller('organizations/:organizationId/operations/:operationId/versions')
export class OperationVersionsController {
  constructor(private readonly versions: OperationVersionsService) {}

  @Get()
  @RequireOrganization()
  @RequirePermission('operation.view')
  list(
    @Param('operationId') operationId: string,
    @CurrentContext() ctx: AuthenticatedRequestContext,
    @Query(new ZodValidationPipe(cursorPageParams)) query: ReturnType<typeof cursorPageParams.parse>,
  ): Promise<VersionListEnvelope> {
    return this.versions.list(ctx, operationId, query.limit, query.cursor);
  }

  @Post()
  @RequireOrganization()
  @RequirePermission('operation.edit')
  async create(
    @Param('operationId') operationId: string,
    @CurrentContext() ctx: AuthenticatedRequestContext,
    @Body(new ZodValidationPipe(createOperationVersionRequest)) body: CreateOperationVersionRequest,
    @Headers('idempotency-key') key: string,
  ): Promise<VersionEnvelope> {
    return (await this.versions.create(ctx, operationId, body, requireIdempotencyKey(key))).body;
  }

  @Get(':versionId')
  @RequireOrganization()
  @RequirePermission('operation.view')
  get(
    @Param('operationId') operationId: string,
    @Param('versionId') versionId: string,
    @CurrentContext() ctx: AuthenticatedRequestContext,
  ): Promise<VersionEnvelope> {
    return this.versions.get(ctx, operationId, versionId);
  }

  @Patch(':versionId')
  @RequireOrganization()
  @RequirePermission('operation.edit')
  update(
    @Param('operationId') operationId: string,
    @Param('versionId') versionId: string,
    @CurrentContext() ctx: AuthenticatedRequestContext,
    @Body(new ZodValidationPipe(updateOperationVersionRequest)) body: UpdateOperationVersionRequest,
  ): Promise<VersionEnvelope> {
    return this.versions.updateDraft(ctx, operationId, versionId, body);
  }

  @Post(':versionId/publish')
  @HttpCode(200)
  @RequireOrganization()
  @RequirePermission('operation.publish')
  async publish(
    @Param('operationId') operationId: string,
    @Param('versionId') versionId: string,
    @CurrentContext() ctx: AuthenticatedRequestContext,
    @Body(new ZodValidationPipe(publishOperationVersionRequest)) body: PublishOperationVersionRequest,
    @Headers('idempotency-key') key: string,
  ) {
    return (await this.versions.publish(ctx, operationId, versionId, body, requireIdempotencyKey(key))).body;
  }

  @Get(':versionId/compare/:otherVersionId')
  @RequireOrganization()
  @RequirePermission('operation.view')
  compare(
    @Param('operationId') operationId: string,
    @Param('versionId') versionId: string,
    @Param('otherVersionId') otherVersionId: string,
    @CurrentContext() ctx: AuthenticatedRequestContext,
  ) {
    return this.versions.compare(ctx, operationId, versionId, otherVersionId);
  }
}
