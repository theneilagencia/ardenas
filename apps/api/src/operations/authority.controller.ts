/**
 * Arden.AS API — endpoints do Gradiente de Autoridade (ARDEN-BE-003).
 * `GET/PATCH .../versions/{versionId}/authority`. O PATCH retorna a VERSÃO
 * atualizada (OperationVersionResponse), conforme o contrato.
 */

import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import {
  updateAuthorityProfileRequest,
  type UpdateAuthorityProfileRequest,
  type AuthorityProfile,
} from '@arden/contracts';
import { RequireOrganization, RequirePermission } from '../authz/decorators';
import { CurrentContext, type AuthenticatedRequestContext } from '../identity/request-context';
import { ZodValidationPipe } from '../common/validation/zod-validation.pipe';
import { OperationVersionsService, type VersionEnvelope } from './operation-versions.service';

@Controller('organizations/:organizationId/operations/:operationId/versions/:versionId/authority')
export class AuthorityController {
  constructor(private readonly versions: OperationVersionsService) {}

  @Get()
  @RequireOrganization()
  @RequirePermission('operation.view')
  get(
    @Param('operationId') operationId: string,
    @Param('versionId') versionId: string,
    @CurrentContext() ctx: AuthenticatedRequestContext,
  ): Promise<{ data: AuthorityProfile }> {
    return this.versions.getAuthority(ctx, operationId, versionId);
  }

  @Patch()
  @RequireOrganization()
  @RequirePermission('operation.edit')
  update(
    @Param('operationId') operationId: string,
    @Param('versionId') versionId: string,
    @CurrentContext() ctx: AuthenticatedRequestContext,
    @Body(new ZodValidationPipe(updateAuthorityProfileRequest)) body: UpdateAuthorityProfileRequest,
  ): Promise<VersionEnvelope> {
    return this.versions.updateAuthority(ctx, operationId, versionId, body);
  }
}
