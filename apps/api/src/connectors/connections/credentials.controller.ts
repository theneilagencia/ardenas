/**
 * Arden.AS API — endpoints de credenciais (ARDEN-BE-006.4).
 *
 * Controllers FINOS. Aplicam autenticação + tenant + permissão + idempotência. O
 * request de criação/rotação carrega o segredo (write-only); NENHUMA resposta
 * devolve segredo — só metadados. NÃO existe endpoint de resolução de segredo.
 */

import { Body, Controller, Get, Headers, HttpCode, Param, Post } from '@nestjs/common';
import {
  createConnectionCredentialRequest,
  rotateConnectionCredentialRequest,
  type CreateConnectionCredentialRequest,
  type RotateConnectionCredentialRequest,
} from '@arden/contracts';
import { RequireOrganization, RequirePermission } from '../../authz/decorators';
import { CurrentContext, type AuthenticatedRequestContext } from '../../identity/request-context';
import { ZodValidationPipe } from '../../common/validation/zod-validation.pipe';
import { requireIdempotencyKey } from '../../operations/request-headers';
import { CredentialVersionsService } from './credential-versions.service';

@Controller('organizations/:organizationId/connections/:connectionId/credentials')
export class CredentialsController {
  constructor(private readonly credentials: CredentialVersionsService) {}

  @Get()
  @RequireOrganization()
  @RequirePermission('connection.view')
  list(@Param('connectionId') connectionId: string, @CurrentContext() ctx: AuthenticatedRequestContext) {
    return this.credentials.list(ctx, connectionId);
  }

  @Post()
  @RequireOrganization()
  @RequirePermission('connection.rotate_credentials')
  async create(
    @Param('connectionId') connectionId: string,
    @CurrentContext() ctx: AuthenticatedRequestContext,
    @Body(new ZodValidationPipe(createConnectionCredentialRequest)) body: CreateConnectionCredentialRequest,
    @Headers('idempotency-key') key: string,
  ) {
    return (await this.credentials.create(ctx, connectionId, body, requireIdempotencyKey(key))).body;
  }

  @Post('rotate')
  @HttpCode(201)
  @RequireOrganization()
  @RequirePermission('connection.rotate_credentials')
  async rotate(
    @Param('connectionId') connectionId: string,
    @CurrentContext() ctx: AuthenticatedRequestContext,
    @Body(new ZodValidationPipe(rotateConnectionCredentialRequest)) body: RotateConnectionCredentialRequest,
    @Headers('idempotency-key') key: string,
  ) {
    return (await this.credentials.rotate(ctx, connectionId, body, requireIdempotencyKey(key))).body;
  }

  @Post(':credentialVersionId/revoke')
  @HttpCode(200)
  @RequireOrganization()
  @RequirePermission('connection.revoke')
  revoke(
    @Param('connectionId') connectionId: string,
    @Param('credentialVersionId') credentialVersionId: string,
    @CurrentContext() ctx: AuthenticatedRequestContext,
    @Headers('idempotency-key') key: string,
  ) {
    requireIdempotencyKey(key);
    return this.credentials.revoke(ctx, connectionId, credentialVersionId);
  }
}
