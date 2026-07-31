/**
 * Arden.AS API — endpoints de enforcement de autoridade (ARDEN-BE-004).
 * Avalia ações e valida autorizações. NÃO executa a ação (execução é BE-005).
 */

import { Body, Controller, HttpCode, Param, Post } from '@nestjs/common';
import {
  evaluateActionRequest,
  validateAuthorizationRequest,
  type EvaluateActionRequest,
  type ValidateAuthorizationRequest,
} from '@arden/contracts';
import { RequireOrganization, RequirePermission } from '../authz/decorators';
import { CurrentContext, type AuthenticatedRequestContext } from '../identity/request-context';
import { ZodValidationPipe } from '../common/validation/zod-validation.pipe';
import { EnforcementService } from './enforcement.service';

@Controller('organizations/:organizationId')
export class EnforcementController {
  constructor(private readonly enforcement: EnforcementService) {}

  @Post('operations/:operationId/actions/evaluate')
  @HttpCode(200)
  @RequireOrganization()
  @RequirePermission('authority.evaluate')
  evaluate(
    @Param('operationId') operationId: string,
    @CurrentContext() ctx: AuthenticatedRequestContext,
    @Body(new ZodValidationPipe(evaluateActionRequest)) body: EvaluateActionRequest,
  ) {
    return this.enforcement.evaluate(ctx, operationId, body);
  }

  @Post('action-authorizations/validate')
  @HttpCode(200)
  @RequireOrganization()
  @RequirePermission('authority.evaluate')
  validate(
    @CurrentContext() ctx: AuthenticatedRequestContext,
    @Body(new ZodValidationPipe(validateAuthorizationRequest)) body: ValidateAuthorizationRequest,
  ) {
    return this.enforcement.validate(ctx, body);
  }
}
