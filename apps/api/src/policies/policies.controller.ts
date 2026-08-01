/**
 * Arden.AS API — endpoints de políticas (ARDEN-BE-004). Controllers finos.
 */

import { Body, Controller, Get, Headers, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import {
  createPolicyRequest,
  updatePolicyRequest,
  createPolicyVersionRequest,
  updatePolicyVersionRequest,
  publishPolicyVersionRequest,
  policyTransitionRequest,
  cursorPageParams,
  type CreatePolicyRequest,
  type UpdatePolicyRequest,
  type CreatePolicyVersionRequest,
  type UpdatePolicyVersionRequest,
  type PublishPolicyVersionRequest,
  type PolicyTransitionRequest,
} from '@arden/contracts';
import { RequireOrganization, RequirePermission } from '../authz/decorators';
import { CurrentContext, type AuthenticatedRequestContext } from '../identity/request-context';
import { ZodValidationPipe } from '../common/validation/zod-validation.pipe';
import { PoliciesService } from './policies.service';
import { requireIdempotencyKey } from '../operations/request-headers';

@Controller('organizations/:organizationId/policies')
export class PoliciesController {
  constructor(private readonly policies: PoliciesService) {}

  @Get()
  @RequireOrganization()
  @RequirePermission('policy.view')
  list(
    @CurrentContext() ctx: AuthenticatedRequestContext,
    @Query(new ZodValidationPipe(cursorPageParams)) query: ReturnType<typeof cursorPageParams.parse>,
  ) {
    return this.policies.list(ctx, query.limit, query.cursor);
  }

  @Post()
  @RequireOrganization()
  @RequirePermission('policy.create')
  async create(
    @CurrentContext() ctx: AuthenticatedRequestContext,
    @Body(new ZodValidationPipe(createPolicyRequest)) body: CreatePolicyRequest,
    @Headers('idempotency-key') key: string,
  ) {
    return (await this.policies.create(ctx, body, requireIdempotencyKey(key))).body;
  }

  @Get(':policyId')
  @RequireOrganization()
  @RequirePermission('policy.view')
  get(@Param('policyId') policyId: string, @CurrentContext() ctx: AuthenticatedRequestContext) {
    return this.policies.get(ctx, policyId);
  }

  @Patch(':policyId')
  @RequireOrganization()
  @RequirePermission('policy.edit')
  update(
    @Param('policyId') policyId: string,
    @CurrentContext() ctx: AuthenticatedRequestContext,
    @Body(new ZodValidationPipe(updatePolicyRequest)) body: UpdatePolicyRequest,
  ) {
    return this.policies.update(ctx, policyId, body);
  }

  @Post(':policyId/versions')
  @RequireOrganization()
  @RequirePermission('policy.edit')
  async createVersion(
    @Param('policyId') policyId: string,
    @CurrentContext() ctx: AuthenticatedRequestContext,
    @Body(new ZodValidationPipe(createPolicyVersionRequest)) body: CreatePolicyVersionRequest,
    @Headers('idempotency-key') key: string,
  ) {
    return (await this.policies.createVersion(ctx, policyId, body, requireIdempotencyKey(key))).body;
  }

  @Patch(':policyId/versions/:versionId')
  @RequireOrganization()
  @RequirePermission('policy.edit')
  updateDraft(
    @Param('policyId') policyId: string,
    @Param('versionId') versionId: string,
    @CurrentContext() ctx: AuthenticatedRequestContext,
    @Body(new ZodValidationPipe(updatePolicyVersionRequest)) body: UpdatePolicyVersionRequest,
  ) {
    return this.policies.updateDraft(ctx, policyId, versionId, body);
  }

  @Post(':policyId/versions/:versionId/publish')
  @HttpCode(200)
  @RequireOrganization()
  @RequirePermission('policy.publish')
  async publish(
    @Param('policyId') policyId: string,
    @Param('versionId') versionId: string,
    @CurrentContext() ctx: AuthenticatedRequestContext,
    @Body(new ZodValidationPipe(publishPolicyVersionRequest)) body: PublishPolicyVersionRequest,
    @Headers('idempotency-key') key: string,
  ) {
    return (await this.policies.publish(ctx, policyId, versionId, body, requireIdempotencyKey(key))).body;
  }

  @Post(':policyId/suspend')
  @HttpCode(200)
  @RequireOrganization()
  @RequirePermission('policy.suspend')
  async suspend(
    @Param('policyId') policyId: string,
    @CurrentContext() ctx: AuthenticatedRequestContext,
    @Body(new ZodValidationPipe(policyTransitionRequest)) body: PolicyTransitionRequest,
    @Headers('idempotency-key') key: string,
  ) {
    return (await this.policies.transition(ctx, policyId, body, requireIdempotencyKey(key), 'SUSPENDED', 'policy.suspended')).body;
  }

  @Post(':policyId/archive')
  @HttpCode(200)
  @RequireOrganization()
  @RequirePermission('policy.suspend')
  async archive(
    @Param('policyId') policyId: string,
    @CurrentContext() ctx: AuthenticatedRequestContext,
    @Body(new ZodValidationPipe(policyTransitionRequest)) body: PolicyTransitionRequest,
    @Headers('idempotency-key') key: string,
  ) {
    return (await this.policies.transition(ctx, policyId, body, requireIdempotencyKey(key), 'ARCHIVED', 'policy.archived')).body;
  }
}
