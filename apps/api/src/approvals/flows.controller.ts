/**
 * Arden.AS API — endpoints de fluxos de aprovação (ARDEN-BE-004).
 */

import { Body, Controller, Get, Headers, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import {
  createApprovalFlowRequest,
  updateApprovalFlowRequest,
  approvalFlowTransitionRequest,
  cursorPageParams,
  type CreateApprovalFlowRequest,
  type UpdateApprovalFlowRequest,
  type ApprovalFlowTransitionRequest,
} from '@arden/contracts';
import { RequireOrganization, RequirePermission } from '../authz/decorators';
import { CurrentContext, type AuthenticatedRequestContext } from '../identity/request-context';
import { ZodValidationPipe } from '../common/validation/zod-validation.pipe';
import { ApprovalFlowsService } from './flows.service';
import { requireIdempotencyKey } from '../operations/request-headers';

@Controller('organizations/:organizationId/approval-flows')
export class ApprovalFlowsController {
  constructor(private readonly flows: ApprovalFlowsService) {}

  @Get()
  @RequireOrganization()
  @RequirePermission('approval.view')
  list(
    @CurrentContext() ctx: AuthenticatedRequestContext,
    @Query(new ZodValidationPipe(cursorPageParams)) query: ReturnType<typeof cursorPageParams.parse>,
  ) {
    return this.flows.list(ctx, query.limit, query.cursor);
  }

  @Post()
  @RequireOrganization()
  @RequirePermission('policy.manage')
  async create(
    @CurrentContext() ctx: AuthenticatedRequestContext,
    @Body(new ZodValidationPipe(createApprovalFlowRequest)) body: CreateApprovalFlowRequest,
    @Headers('idempotency-key') key: string,
  ) {
    return (await this.flows.create(ctx, body, requireIdempotencyKey(key))).body;
  }

  @Get(':flowId')
  @RequireOrganization()
  @RequirePermission('approval.view')
  get(@Param('flowId') flowId: string, @CurrentContext() ctx: AuthenticatedRequestContext) {
    return this.flows.get(ctx, flowId);
  }

  @Patch(':flowId')
  @RequireOrganization()
  @RequirePermission('policy.manage')
  update(
    @Param('flowId') flowId: string,
    @CurrentContext() ctx: AuthenticatedRequestContext,
    @Body(new ZodValidationPipe(updateApprovalFlowRequest)) body: UpdateApprovalFlowRequest,
  ) {
    return this.flows.update(ctx, flowId, body);
  }

  @Post(':flowId/activate')
  @HttpCode(200)
  @RequireOrganization()
  @RequirePermission('policy.manage')
  async activate(
    @Param('flowId') flowId: string,
    @CurrentContext() ctx: AuthenticatedRequestContext,
    @Body(new ZodValidationPipe(approvalFlowTransitionRequest)) body: ApprovalFlowTransitionRequest,
    @Headers('idempotency-key') key: string,
  ) {
    return (await this.flows.transition(ctx, flowId, body, requireIdempotencyKey(key), 'ACTIVE', 'approval_flow.activated')).body;
  }

  @Post(':flowId/suspend')
  @HttpCode(200)
  @RequireOrganization()
  @RequirePermission('policy.manage')
  async suspend(
    @Param('flowId') flowId: string,
    @CurrentContext() ctx: AuthenticatedRequestContext,
    @Body(new ZodValidationPipe(approvalFlowTransitionRequest)) body: ApprovalFlowTransitionRequest,
    @Headers('idempotency-key') key: string,
  ) {
    return (await this.flows.transition(ctx, flowId, body, requireIdempotencyKey(key), 'SUSPENDED', 'approval_flow.suspended')).body;
  }
}
