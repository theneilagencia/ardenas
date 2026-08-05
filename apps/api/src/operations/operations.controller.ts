/**
 * Arden.AS API — endpoints de operações (ARDEN-BE-003). Controllers FINOS: aplicam
 * decorators de autorização, validam o body pelo contrato e delegam ao serviço.
 * Tenant vem do path (`:organizationId`) e é validado pelo guard; permissões pelo
 * `PermissionGuard`. Nenhuma transação/regra vive aqui.
 */

import { Body, Controller, Get, Headers, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import {
  createOperationRequest,
  updateOperationRequest,
  archiveOperationRequest,
  duplicateOperationRequest,
  operationTransitionRequest,
  listOperationsQuery,
  type CreateOperationRequest,
  type UpdateOperationRequest,
  type ArchiveOperationRequest,
  type DuplicateOperationRequest,
  type OperationTransitionRequest,
  type ListOperationsQuery,
} from '@arden/contracts';
import { RequireOrganization, RequirePermission } from '../authz/decorators';
import { CurrentContext, type AuthenticatedRequestContext } from '../identity/request-context';
import { ZodValidationPipe } from '../common/validation/zod-validation.pipe';
import { OperationsService, type OperationEnvelope, type OperationListEnvelope } from './operations.service';
import { requireIdempotencyKey } from './request-headers';

@Controller('organizations/:organizationId/operations')
export class OperationsController {
  constructor(private readonly ops: OperationsService) {}

  @Get()
  @RequireOrganization()
  @RequirePermission('operation.view')
  list(
    @CurrentContext() ctx: AuthenticatedRequestContext,
    @Query(new ZodValidationPipe(listOperationsQuery)) query: ListOperationsQuery,
  ): Promise<OperationListEnvelope> {
    return this.ops.list(ctx, query);
  }

  @Post()
  @RequireOrganization()
  @RequirePermission('operation.create')
  async create(
    @CurrentContext() ctx: AuthenticatedRequestContext,
    @Body(new ZodValidationPipe(createOperationRequest)) body: CreateOperationRequest,
    @Headers('idempotency-key') key: string,
  ): Promise<OperationEnvelope> {
    return (await this.ops.create(ctx, body, requireIdempotencyKey(key))).body;
  }

  @Get(':operationId')
  @RequireOrganization()
  @RequirePermission('operation.view')
  get(
    @Param('operationId') operationId: string,
    @CurrentContext() ctx: AuthenticatedRequestContext,
  ): Promise<OperationEnvelope> {
    return this.ops.get(ctx, operationId);
  }

  @Patch(':operationId')
  @RequireOrganization()
  @RequirePermission('operation.edit')
  update(
    @Param('operationId') operationId: string,
    @CurrentContext() ctx: AuthenticatedRequestContext,
    @Body(new ZodValidationPipe(updateOperationRequest)) body: UpdateOperationRequest,
  ): Promise<OperationEnvelope> {
    return this.ops.update(ctx, operationId, body);
  }

  @Post(':operationId/pause')
  @HttpCode(200)
  @RequireOrganization()
  @RequirePermission('operation.pause')
  pause(
    @Param('operationId') operationId: string,
    @CurrentContext() ctx: AuthenticatedRequestContext,
    @Body(new ZodValidationPipe(operationTransitionRequest)) body: OperationTransitionRequest,
  ): Promise<OperationEnvelope> {
    return this.ops.pause(ctx, operationId, body);
  }

  @Post(':operationId/resume')
  @HttpCode(200)
  @RequireOrganization()
  @RequirePermission('operation.pause')
  resume(
    @Param('operationId') operationId: string,
    @CurrentContext() ctx: AuthenticatedRequestContext,
    @Body(new ZodValidationPipe(operationTransitionRequest)) body: OperationTransitionRequest,
  ): Promise<OperationEnvelope> {
    return this.ops.resume(ctx, operationId, body);
  }

  @Post(':operationId/archive')
  @HttpCode(200)
  @RequireOrganization()
  @RequirePermission('operation.edit')
  async archive(
    @Param('operationId') operationId: string,
    @CurrentContext() ctx: AuthenticatedRequestContext,
    @Body(new ZodValidationPipe(archiveOperationRequest)) body: ArchiveOperationRequest,
    @Headers('idempotency-key') key: string,
  ): Promise<OperationEnvelope> {
    return (await this.ops.archive(ctx, operationId, body, requireIdempotencyKey(key))).body;
  }

  @Post(':operationId/duplicate')
  @HttpCode(201)
  @RequireOrganization()
  @RequirePermission('operation.create')
  async duplicate(
    @Param('operationId') operationId: string,
    @CurrentContext() ctx: AuthenticatedRequestContext,
    @Body(new ZodValidationPipe(duplicateOperationRequest)) body: DuplicateOperationRequest,
    @Headers('idempotency-key') key: string,
  ): Promise<OperationEnvelope> {
    return (await this.ops.duplicate(ctx, operationId, body, requireIdempotencyKey(key))).body;
  }
}
