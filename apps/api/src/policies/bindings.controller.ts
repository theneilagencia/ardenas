/**
 * Arden.AS API — endpoints de vínculos política↔operação (ARDEN-BE-004).
 * O DELETE remove o vínculo, nunca a política nem seu histórico.
 */

import { Body, Controller, Delete, Get, Headers, Param, Patch, Post } from '@nestjs/common';
import {
  createPolicyBindingRequest,
  updatePolicyBindingRequest,
  type CreatePolicyBindingRequest,
  type UpdatePolicyBindingRequest,
} from '@arden/contracts';
import { RequireOrganization, RequirePermission } from '../authz/decorators';
import { CurrentContext, type AuthenticatedRequestContext } from '../identity/request-context';
import { ZodValidationPipe } from '../common/validation/zod-validation.pipe';
import { PoliciesService } from './policies.service';
import { requireIdempotencyKey } from '../operations/request-headers';

@Controller('organizations/:organizationId/operations/:operationId/policy-bindings')
export class PolicyBindingsController {
  constructor(private readonly policies: PoliciesService) {}

  @Get()
  @RequireOrganization()
  @RequirePermission('policy.view')
  list(@Param('operationId') operationId: string, @CurrentContext() ctx: AuthenticatedRequestContext) {
    return this.policies.listBindings(ctx, operationId);
  }

  @Post()
  @RequireOrganization()
  @RequirePermission('policy.edit')
  async create(
    @Param('operationId') operationId: string,
    @CurrentContext() ctx: AuthenticatedRequestContext,
    @Body(new ZodValidationPipe(createPolicyBindingRequest)) body: CreatePolicyBindingRequest,
    @Headers('idempotency-key') key: string,
  ) {
    return (await this.policies.createBinding(ctx, operationId, body, requireIdempotencyKey(key))).body;
  }

  @Patch(':bindingId')
  @RequireOrganization()
  @RequirePermission('policy.edit')
  update(
    @Param('operationId') operationId: string,
    @Param('bindingId') bindingId: string,
    @CurrentContext() ctx: AuthenticatedRequestContext,
    @Body(new ZodValidationPipe(updatePolicyBindingRequest)) body: UpdatePolicyBindingRequest,
  ) {
    return this.policies.updateBinding(ctx, operationId, bindingId, body);
  }

  @Delete(':bindingId')
  @RequireOrganization()
  @RequirePermission('policy.edit')
  remove(
    @Param('operationId') operationId: string,
    @Param('bindingId') bindingId: string,
    @CurrentContext() ctx: AuthenticatedRequestContext,
  ) {
    return this.policies.deleteBinding(ctx, operationId, bindingId);
  }
}
