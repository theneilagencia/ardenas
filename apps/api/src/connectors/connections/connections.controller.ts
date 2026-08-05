/**
 * Arden.AS API — endpoints de conexões (ARDEN-BE-006.8).
 *
 * Controllers FINOS: autenticação + tenant + permissão + idempotência + revision +
 * state machine + auditoria. O teste usa o SecureHttpClient (SSRF). Nenhuma resposta
 * devolve segredo.
 */

import { Body, Controller, Get, Headers, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import {
  createConnectionRequest, updateConnectionRequest, testConnectionRequest, connectionCommandRequest, listConnectionsQuery,
  validateConnectionConfigurationRequest,
  type CreateConnectionRequest, type UpdateConnectionRequest, type ConnectionCommandRequest, type ListConnectionsQuery,
} from '@arden/contracts';
import { RequireOrganization, RequirePermission } from '../../authz/decorators';
import { CurrentContext, type AuthenticatedRequestContext } from '../../identity/request-context';
import { ZodValidationPipe } from '../../common/validation/zod-validation.pipe';
import { requireIdempotencyKey } from '../../operations/request-headers';
import { ConnectionsService } from './connections.service';

@Controller('organizations/:organizationId/connections')
export class ConnectionsController {
  constructor(private readonly connections: ConnectionsService) {}

  @Get()
  @RequireOrganization()
  @RequirePermission('connection.view')
  async list(@Query(new ZodValidationPipe(listConnectionsQuery)) query: ListConnectionsQuery, @CurrentContext() ctx: AuthenticatedRequestContext) {
    const res = await this.connections.list(ctx, { status: query.status, search: query.search }, query.limit, query.cursor);
    return { data: res.data, pagination: { cursor: query.cursor ?? null, nextCursor: res.nextCursor, hasNextPage: res.nextCursor !== null, limit: query.limit } };
  }

  @Post()
  @HttpCode(201)
  @RequireOrganization()
  @RequirePermission('connection.create')
  async create(@Body(new ZodValidationPipe(createConnectionRequest)) body: CreateConnectionRequest, @Headers('idempotency-key') key: string | undefined, @CurrentContext() ctx: AuthenticatedRequestContext) {
    return (await this.connections.create(ctx, body, requireIdempotencyKey(key))).body;
  }

  @Get(':connectionId')
  @RequireOrganization()
  @RequirePermission('connection.view')
  get(@Param('connectionId') id: string, @CurrentContext() ctx: AuthenticatedRequestContext) {
    return this.connections.get(ctx, id);
  }

  @Patch(':connectionId')
  @RequireOrganization()
  @RequirePermission('connection.edit')
  update(@Param('connectionId') id: string, @Body(new ZodValidationPipe(updateConnectionRequest)) body: UpdateConnectionRequest, @CurrentContext() ctx: AuthenticatedRequestContext) {
    return this.connections.update(ctx, id, body);
  }

  @Post(':connectionId/test')
  @HttpCode(200)
  @RequireOrganization()
  @RequirePermission('connection.test')
  test(@Param('connectionId') id: string, @Body(new ZodValidationPipe(testConnectionRequest)) _body: unknown, @CurrentContext() ctx: AuthenticatedRequestContext) {
    return this.connections.test(ctx, id);
  }

  // Validação LOCAL de configuração (ARDEN-BE-008.2 §17). NÃO contata o provider/rede;
  // declara NOT_VERIFIED_WITH_PROVIDER. Distinta de `test` (que faz rede em conectores HTTP).
  @Post(':connectionId/validate-configuration')
  @HttpCode(200)
  @RequireOrganization()
  @RequirePermission('connection.test')
  validateConfiguration(@Param('connectionId') id: string, @Body(new ZodValidationPipe(validateConnectionConfigurationRequest)) _body: unknown, @CurrentContext() ctx: AuthenticatedRequestContext) {
    return this.connections.validateConfiguration(ctx, id);
  }

  @Post(':connectionId/activate')
  @HttpCode(200)
  @RequireOrganization()
  @RequirePermission('connection.edit')
  activate(@Param('connectionId') id: string, @Body(new ZodValidationPipe(connectionCommandRequest)) body: ConnectionCommandRequest, @CurrentContext() ctx: AuthenticatedRequestContext) {
    return this.connections.transitionStatus(ctx, id, 'ACTIVE', body.expectedRevision, body.reason);
  }

  @Post(':connectionId/suspend')
  @HttpCode(200)
  @RequireOrganization()
  @RequirePermission('connection.edit')
  suspend(@Param('connectionId') id: string, @Body(new ZodValidationPipe(connectionCommandRequest)) body: ConnectionCommandRequest, @CurrentContext() ctx: AuthenticatedRequestContext) {
    return this.connections.transitionStatus(ctx, id, 'SUSPENDED', body.expectedRevision, body.reason);
  }

  @Post(':connectionId/reactivate')
  @HttpCode(200)
  @RequireOrganization()
  @RequirePermission('connection.edit')
  reactivate(@Param('connectionId') id: string, @Body(new ZodValidationPipe(connectionCommandRequest)) body: ConnectionCommandRequest, @CurrentContext() ctx: AuthenticatedRequestContext) {
    return this.connections.transitionStatus(ctx, id, 'ACTIVE', body.expectedRevision, body.reason);
  }

  @Post(':connectionId/revoke')
  @HttpCode(200)
  @RequireOrganization()
  @RequirePermission('connection.revoke')
  revoke(@Param('connectionId') id: string, @Body(new ZodValidationPipe(connectionCommandRequest)) body: ConnectionCommandRequest, @CurrentContext() ctx: AuthenticatedRequestContext) {
    return this.connections.transitionStatus(ctx, id, 'REVOKED', body.expectedRevision, body.reason);
  }
}
