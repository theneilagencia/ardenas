/**
 * Arden.AS API — endpoints de tool bindings (ARDEN-BE-006.6).
 *
 * Controllers FINOS. Aplicam autenticação + tenant + permissão + idempotência +
 * revision + contratos compartilhados. Sem fallback. Nenhum endpoint de execução
 * direta de ferramenta (a execução ocorre exclusivamente pelo motor de operações).
 */

import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import {
  createOrganizationToolBindingRequest, updateOrganizationToolBindingRequest,
  createOperationToolBindingRequest, updateOperationToolBindingRequest,
  connectionCommandRequest, listToolBindingsQuery,
  type CreateOrganizationToolBindingRequest, type UpdateOrganizationToolBindingRequest,
  type CreateOperationToolBindingRequest, type UpdateOperationToolBindingRequest,
  type ConnectionCommandRequest, type ListToolBindingsQuery,
} from '@arden/contracts';
import { RequireOrganization, RequirePermission } from '../../authz/decorators';
import { CurrentContext, type AuthenticatedRequestContext } from '../../identity/request-context';
import { ZodValidationPipe } from '../../common/validation/zod-validation.pipe';
import { requireIdempotencyKey } from '../../operations/request-headers';
import { Headers } from '@nestjs/common';
import { ToolBindingsService } from './tool-bindings.service';

@Controller('organizations/:organizationId')
export class ToolBindingsController {
  constructor(private readonly bindings: ToolBindingsService) {}

  // ── Organization tool bindings ────────────────────────────────────────────────
  @Get('tool-bindings')
  @RequireOrganization()
  @RequirePermission('tool.view')
  listOrg(@Query(new ZodValidationPipe(listToolBindingsQuery)) query: ListToolBindingsQuery, @CurrentContext() ctx: AuthenticatedRequestContext) {
    return this.bindings.listOrgBindings(ctx, query);
  }

  @Post('tool-bindings')
  @HttpCode(201)
  @RequireOrganization()
  @RequirePermission('tool.bind')
  async createOrg(
    @Body(new ZodValidationPipe(createOrganizationToolBindingRequest)) body: CreateOrganizationToolBindingRequest,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @CurrentContext() ctx: AuthenticatedRequestContext,
  ) {
    const result = await this.bindings.createOrgBinding(ctx, body, requireIdempotencyKey(idempotencyKey));
    return result.body;
  }

  @Get('tool-bindings/:bindingId')
  @RequireOrganization()
  @RequirePermission('tool.view')
  getOrg(@Param('bindingId') bindingId: string, @CurrentContext() ctx: AuthenticatedRequestContext) {
    return this.bindings.getOrgBinding(ctx, bindingId);
  }

  @Patch('tool-bindings/:bindingId')
  @RequireOrganization()
  @RequirePermission('tool.bind')
  updateOrg(
    @Param('bindingId') bindingId: string,
    @Body(new ZodValidationPipe(updateOrganizationToolBindingRequest)) body: UpdateOrganizationToolBindingRequest,
    @CurrentContext() ctx: AuthenticatedRequestContext,
  ) {
    return this.bindings.updateOrgBinding(ctx, bindingId, body);
  }

  @Post('tool-bindings/:bindingId/disable')
  @HttpCode(200)
  @RequireOrganization()
  @RequirePermission('tool.bind')
  disableOrg(
    @Param('bindingId') bindingId: string,
    @Body(new ZodValidationPipe(connectionCommandRequest)) body: ConnectionCommandRequest,
    @CurrentContext() ctx: AuthenticatedRequestContext,
  ) {
    return this.bindings.disableOrgBinding(ctx, bindingId, body.expectedRevision);
  }

  // ── Operation tool bindings ───────────────────────────────────────────────────
  @Get('operations/:operationId/tool-bindings')
  @RequireOrganization()
  @RequirePermission('tool.view')
  listOperation(@Param('operationId') operationId: string, @CurrentContext() ctx: AuthenticatedRequestContext) {
    return this.bindings.listOperationBindings(ctx, operationId);
  }

  @Post('operations/:operationId/tool-bindings')
  @HttpCode(201)
  @RequireOrganization()
  @RequirePermission('tool.bind')
  async createOperation(
    @Param('operationId') operationId: string,
    @Body(new ZodValidationPipe(createOperationToolBindingRequest)) body: CreateOperationToolBindingRequest,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @CurrentContext() ctx: AuthenticatedRequestContext,
  ) {
    const result = await this.bindings.createOperationBinding(ctx, operationId, body, requireIdempotencyKey(idempotencyKey));
    return result.body;
  }

  @Patch('operations/:operationId/tool-bindings/:bindingId')
  @RequireOrganization()
  @RequirePermission('tool.bind')
  updateOperation(
    @Param('operationId') operationId: string,
    @Param('bindingId') bindingId: string,
    @Body(new ZodValidationPipe(updateOperationToolBindingRequest)) body: UpdateOperationToolBindingRequest,
    @CurrentContext() ctx: AuthenticatedRequestContext,
  ) {
    return this.bindings.updateOperationBinding(ctx, operationId, bindingId, body);
  }

  @Delete('operations/:operationId/tool-bindings/:bindingId')
  @RequireOrganization()
  @RequirePermission('tool.bind')
  removeOperation(
    @Param('operationId') operationId: string,
    @Param('bindingId') bindingId: string,
    @Query('expectedRevision') expectedRevision: string | undefined,
    @CurrentContext() ctx: AuthenticatedRequestContext,
  ) {
    return this.bindings.removeOperationBinding(ctx, operationId, bindingId, Number(expectedRevision ?? '0'));
  }
}
