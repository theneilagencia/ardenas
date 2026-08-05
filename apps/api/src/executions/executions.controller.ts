/**
 * Arden.AS API — endpoints de execução (ARDEN-BE-005). Controllers finos: criam e
 * comandam execuções; JAMAIS processam etapas dentro da requisição HTTP.
 */

import { Body, Controller, Get, Headers, HttpCode, Param, Post, Query } from '@nestjs/common';
import {
  createExecutionRequest,
  executionCommandRequest,
  listExecutionsQuery,
  listExecutionEventsQuery,
  type CreateExecutionRequest,
  type ExecutionCommandRequest,
  type ListExecutionsQuery,
  type ListExecutionEventsQuery,
} from '@arden/contracts';
import { RequireOrganization, RequirePermission } from '../authz/decorators';
import { CurrentContext, type AuthenticatedRequestContext } from '../identity/request-context';
import { ZodValidationPipe } from '../common/validation/zod-validation.pipe';
import { ExecutionsService } from './executions.service';
import { requireIdempotencyKey } from '../operations/request-headers';

@Controller('organizations/:organizationId')
export class ExecutionsController {
  constructor(private readonly executions: ExecutionsService) {}

  @Get('executions')
  @RequireOrganization()
  @RequirePermission('execution.view')
  list(
    @CurrentContext() ctx: AuthenticatedRequestContext,
    @Query(new ZodValidationPipe(listExecutionsQuery)) query: ListExecutionsQuery,
  ) {
    return this.executions.list(ctx, query);
  }

  @Post('operations/:operationId/executions')
  @RequireOrganization()
  @RequirePermission('execution.create')
  async create(
    @Param('operationId') operationId: string,
    @CurrentContext() ctx: AuthenticatedRequestContext,
    @Body(new ZodValidationPipe(createExecutionRequest)) body: CreateExecutionRequest,
    @Headers('idempotency-key') key: string,
  ) {
    return (await this.executions.create(ctx, operationId, body, requireIdempotencyKey(key))).body;
  }

  @Get('executions/:executionId')
  @RequireOrganization()
  @RequirePermission('execution.view')
  get(@Param('executionId') executionId: string, @CurrentContext() ctx: AuthenticatedRequestContext) {
    return this.executions.get(ctx, executionId);
  }

  @Post('executions/:executionId/pause')
  @HttpCode(200)
  @RequireOrganization()
  @RequirePermission('execution.pause')
  pause(
    @Param('executionId') executionId: string,
    @CurrentContext() ctx: AuthenticatedRequestContext,
    @Body(new ZodValidationPipe(executionCommandRequest)) body: ExecutionCommandRequest,
  ) {
    return this.executions.pause(ctx, executionId, body);
  }

  @Post('executions/:executionId/resume')
  @HttpCode(200)
  @RequireOrganization()
  @RequirePermission('execution.resume')
  resume(
    @Param('executionId') executionId: string,
    @CurrentContext() ctx: AuthenticatedRequestContext,
    @Body(new ZodValidationPipe(executionCommandRequest)) body: ExecutionCommandRequest,
  ) {
    return this.executions.resume(ctx, executionId, body);
  }

  @Post('executions/:executionId/cancel')
  @HttpCode(200)
  @RequireOrganization()
  @RequirePermission('execution.cancel')
  cancel(
    @Param('executionId') executionId: string,
    @CurrentContext() ctx: AuthenticatedRequestContext,
    @Body(new ZodValidationPipe(executionCommandRequest)) body: ExecutionCommandRequest,
  ) {
    return this.executions.cancel(ctx, executionId, body);
  }

  @Post('executions/:executionId/retry')
  @HttpCode(200)
  @RequireOrganization()
  @RequirePermission('execution.retry')
  retry(
    @Param('executionId') executionId: string,
    @CurrentContext() ctx: AuthenticatedRequestContext,
    @Body(new ZodValidationPipe(executionCommandRequest)) body: ExecutionCommandRequest,
  ) {
    return this.executions.retry(ctx, executionId, body);
  }

  @Get('executions/:executionId/steps')
  @RequireOrganization()
  @RequirePermission('execution.view')
  listSteps(@Param('executionId') executionId: string, @CurrentContext() ctx: AuthenticatedRequestContext) {
    return this.executions.listSteps(ctx, executionId);
  }

  @Get('executions/:executionId/steps/:stepId')
  @RequireOrganization()
  @RequirePermission('execution.view')
  getStep(
    @Param('executionId') executionId: string,
    @Param('stepId') stepId: string,
    @CurrentContext() ctx: AuthenticatedRequestContext,
  ) {
    return this.executions.getStep(ctx, executionId, stepId);
  }

  @Get('executions/:executionId/events')
  @RequireOrganization()
  @RequirePermission('execution.view')
  listEvents(
    @Param('executionId') executionId: string,
    @CurrentContext() ctx: AuthenticatedRequestContext,
    @Query(new ZodValidationPipe(listExecutionEventsQuery)) query: ListExecutionEventsQuery,
  ) {
    return this.executions.listEvents(ctx, executionId, query);
  }

  @Get('executions/:executionId/evidence')
  @RequireOrganization()
  @RequirePermission('evidence.view')
  listEvidence(@Param('executionId') executionId: string, @CurrentContext() ctx: AuthenticatedRequestContext) {
    return this.executions.listEvidence(ctx, executionId);
  }

  @Get('executions/:executionId/evidence/:evidenceId')
  @RequireOrganization()
  @RequirePermission('evidence.view')
  getEvidence(
    @Param('executionId') executionId: string,
    @Param('evidenceId') evidenceId: string,
    @CurrentContext() ctx: AuthenticatedRequestContext,
  ) {
    return this.executions.getEvidence(ctx, executionId, evidenceId);
  }
}
