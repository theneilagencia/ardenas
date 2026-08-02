/**
 * Arden.AS API — controller de versões de agente (ARDEN-BE-007.2).
 * Rascunho editável; publicação/retirada imutáveis. Idempotência/concorrência por contrato.
 */

import { Body, Controller, Get, Headers, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import {
  createAgentVersionRequest,
  updateAgentVersionRequest,
  publishAgentVersionRequest,
  retireAgentVersionRequest,
  listAgentVersionsQuery,
  type CreateAgentVersionRequest,
  type UpdateAgentVersionRequest,
  type PublishAgentVersionRequest,
  type RetireAgentVersionRequest,
  type ListAgentVersionsQuery,
} from '@arden/contracts';
import { RequireOrganization, RequirePermission } from '../../authz/decorators';
import { CurrentContext, type AuthenticatedRequestContext } from '../../identity/request-context';
import { ZodValidationPipe } from '../../common/validation/zod-validation.pipe';
import { requireIdempotencyKey } from '../../operations/request-headers';
import { AgentVersionsService } from './agent-versions.service';

@Controller('organizations/:organizationId/agents/:agentId/versions')
export class AgentVersionsController {
  constructor(private readonly versions: AgentVersionsService) {}

  @Get()
  @RequireOrganization()
  @RequirePermission('agent.view')
  async list(
    @Param('agentId') agentId: string,
    @Query(new ZodValidationPipe(listAgentVersionsQuery)) query: ListAgentVersionsQuery,
    @CurrentContext() ctx: AuthenticatedRequestContext,
  ) {
    const res = await this.versions.list(ctx, agentId, { status: query.status, versionNumber: query.versionNumber }, query.limit, query.cursor);
    return { data: res.data, pagination: { cursor: query.cursor ?? null, nextCursor: res.nextCursor, hasNextPage: res.nextCursor !== null, limit: query.limit } };
  }

  @Post()
  @HttpCode(201)
  @RequireOrganization()
  @RequirePermission('agent.edit')
  async create(
    @Param('agentId') agentId: string,
    @Body(new ZodValidationPipe(createAgentVersionRequest)) body: CreateAgentVersionRequest,
    @Headers('idempotency-key') key: string | undefined,
    @CurrentContext() ctx: AuthenticatedRequestContext,
  ) {
    return (await this.versions.createDraft(ctx, agentId, body, requireIdempotencyKey(key))).body;
  }

  @Get(':agentVersionId')
  @RequireOrganization()
  @RequirePermission('agent.view')
  get(
    @Param('agentId') agentId: string,
    @Param('agentVersionId') agentVersionId: string,
    @CurrentContext() ctx: AuthenticatedRequestContext,
  ) {
    return this.versions.get(ctx, agentId, agentVersionId);
  }

  @Patch(':agentVersionId')
  @RequireOrganization()
  @RequirePermission('agent.edit')
  update(
    @Param('agentId') agentId: string,
    @Param('agentVersionId') agentVersionId: string,
    @Body(new ZodValidationPipe(updateAgentVersionRequest)) body: UpdateAgentVersionRequest,
    @CurrentContext() ctx: AuthenticatedRequestContext,
  ) {
    return this.versions.updateDraft(ctx, agentId, agentVersionId, body);
  }

  @Post(':agentVersionId/publish')
  @HttpCode(200)
  @RequireOrganization()
  @RequirePermission('agent.publish')
  async publish(
    @Param('agentId') agentId: string,
    @Param('agentVersionId') agentVersionId: string,
    @Body(new ZodValidationPipe(publishAgentVersionRequest)) body: PublishAgentVersionRequest,
    @Headers('idempotency-key') key: string | undefined,
    @CurrentContext() ctx: AuthenticatedRequestContext,
  ) {
    return (await this.versions.publish(ctx, agentId, agentVersionId, body, requireIdempotencyKey(key))).body;
  }

  @Post(':agentVersionId/retire')
  @HttpCode(200)
  @RequireOrganization()
  @RequirePermission('agent.publish')
  async retire(
    @Param('agentId') agentId: string,
    @Param('agentVersionId') agentVersionId: string,
    @Body(new ZodValidationPipe(retireAgentVersionRequest)) body: RetireAgentVersionRequest,
    @Headers('idempotency-key') key: string | undefined,
    @CurrentContext() ctx: AuthenticatedRequestContext,
  ) {
    return (await this.versions.retire(ctx, agentId, agentVersionId, body, requireIdempotencyKey(key))).body;
  }
}
