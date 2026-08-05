/**
 * Arden.AS API — endpoints de solicitações e decisões de aprovação (ARDEN-BE-004).
 * A solicitação nasce por operação; as decisões são por solicitação. O servidor
 * decide — o cliente apenas solicita/decide dentro das regras.
 */

import { Body, Controller, Get, Headers, HttpCode, Param, Post, Query } from '@nestjs/common';
import {
  createApprovalRequestRequest,
  decideApprovalRequest,
  cancelApprovalRequest,
  listApprovalRequestsQuery,
  type CreateApprovalRequestRequest,
  type DecideApprovalRequest,
  type CancelApprovalRequest,
  type ListApprovalRequestsQuery,
} from '@arden/contracts';
import { RequireOrganization, RequirePermission } from '../authz/decorators';
import { CurrentContext, type AuthenticatedRequestContext } from '../identity/request-context';
import { ZodValidationPipe } from '../common/validation/zod-validation.pipe';
import { ApprovalRequestsService } from './requests.service';
import { requireIdempotencyKey } from '../operations/request-headers';

@Controller('organizations/:organizationId')
export class ApprovalRequestsController {
  constructor(private readonly requests: ApprovalRequestsService) {}

  @Get('approval-requests')
  @RequireOrganization()
  @RequirePermission('approval.view')
  list(
    @CurrentContext() ctx: AuthenticatedRequestContext,
    @Query(new ZodValidationPipe(listApprovalRequestsQuery)) query: ListApprovalRequestsQuery,
  ) {
    return this.requests.list(ctx, query);
  }

  @Post('operations/:operationId/approval-requests')
  @RequireOrganization()
  @RequirePermission('approval.request')
  async create(
    @Param('operationId') operationId: string,
    @CurrentContext() ctx: AuthenticatedRequestContext,
    @Body(new ZodValidationPipe(createApprovalRequestRequest)) body: CreateApprovalRequestRequest,
    @Headers('idempotency-key') key: string,
  ) {
    return (await this.requests.create(ctx, operationId, body, requireIdempotencyKey(key))).body;
  }

  @Get('approval-requests/:requestId')
  @RequireOrganization()
  @RequirePermission('approval.view')
  get(@Param('requestId') requestId: string, @CurrentContext() ctx: AuthenticatedRequestContext) {
    return this.requests.get(ctx, requestId);
  }

  @Post('approval-requests/:requestId/approve')
  @HttpCode(200)
  @RequireOrganization()
  @RequirePermission('approval.resolve')
  approve(
    @Param('requestId') requestId: string,
    @CurrentContext() ctx: AuthenticatedRequestContext,
    @Body(new ZodValidationPipe(decideApprovalRequest)) body: DecideApprovalRequest,
  ) {
    return this.requests.approve(ctx, requestId, body);
  }

  @Post('approval-requests/:requestId/reject')
  @HttpCode(200)
  @RequireOrganization()
  @RequirePermission('approval.resolve')
  reject(
    @Param('requestId') requestId: string,
    @CurrentContext() ctx: AuthenticatedRequestContext,
    @Body(new ZodValidationPipe(decideApprovalRequest)) body: DecideApprovalRequest,
  ) {
    return this.requests.reject(ctx, requestId, body);
  }

  @Post('approval-requests/:requestId/cancel')
  @HttpCode(200)
  @RequireOrganization()
  @RequirePermission('approval.cancel')
  cancel(
    @Param('requestId') requestId: string,
    @CurrentContext() ctx: AuthenticatedRequestContext,
    @Body(new ZodValidationPipe(cancelApprovalRequest)) body: CancelApprovalRequest,
  ) {
    return this.requests.cancel(ctx, requestId, body);
  }
}
