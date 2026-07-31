/**
 * Arden.AS API — endpoints de delegações de aprovação (ARDEN-BE-004).
 */

import { Body, Controller, Get, Headers, HttpCode, Param, Post } from '@nestjs/common';
import {
  createApprovalDelegationRequest,
  revokeApprovalDelegationRequest,
  type CreateApprovalDelegationRequest,
  type RevokeApprovalDelegationRequest,
} from '@arden/contracts';
import { RequireOrganization, RequirePermission } from '../authz/decorators';
import { CurrentContext, type AuthenticatedRequestContext } from '../identity/request-context';
import { ZodValidationPipe } from '../common/validation/zod-validation.pipe';
import { ApprovalDelegationsService } from './delegations.service';
import { requireIdempotencyKey } from '../operations/request-headers';

@Controller('organizations/:organizationId/approval-delegations')
export class ApprovalDelegationsController {
  constructor(private readonly delegations: ApprovalDelegationsService) {}

  @Get()
  @RequireOrganization()
  @RequirePermission('approval.view')
  list(@CurrentContext() ctx: AuthenticatedRequestContext) {
    return this.delegations.list(ctx);
  }

  @Post()
  @RequireOrganization()
  @RequirePermission('approval.delegate')
  async create(
    @CurrentContext() ctx: AuthenticatedRequestContext,
    @Body(new ZodValidationPipe(createApprovalDelegationRequest)) body: CreateApprovalDelegationRequest,
    @Headers('idempotency-key') key: string,
  ) {
    return (await this.delegations.create(ctx, body, requireIdempotencyKey(key))).body;
  }

  @Post(':delegationId/revoke')
  @HttpCode(200)
  @RequireOrganization()
  @RequirePermission('approval.delegate')
  async revoke(
    @Param('delegationId') delegationId: string,
    @CurrentContext() ctx: AuthenticatedRequestContext,
    @Body(new ZodValidationPipe(revokeApprovalDelegationRequest)) body: RevokeApprovalDelegationRequest,
    @Headers('idempotency-key') key: string,
  ) {
    return (await this.delegations.revoke(ctx, delegationId, body, requireIdempotencyKey(key))).body;
  }
}
