/**
 * Arden.AS API — controller administrativo de agentes (ARDEN-BE-007.2).
 * Tenant no path; autorização por permissão; idempotência/concorrência conforme contrato.
 * Sem endpoint de execução — a execução ocorre pelo motor de operações (agent.execute).
 */

import { Body, Controller, Get, Headers, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import {
  createAgentRequest,
  updateAgentRequest,
  agentCommandRequest,
  listAgentsQuery,
  type CreateAgentRequest,
  type UpdateAgentRequest,
  type AgentCommandRequest,
  type ListAgentsQuery,
} from '@arden/contracts';
import { RequireOrganization, RequirePermission } from '../../authz/decorators';
import { CurrentContext, type AuthenticatedRequestContext } from '../../identity/request-context';
import { ZodValidationPipe } from '../../common/validation/zod-validation.pipe';
import { requireIdempotencyKey } from '../../operations/request-headers';
import { AgentsService } from './agents.service';

@Controller('organizations/:organizationId/agents')
export class AgentsController {
  constructor(private readonly agents: AgentsService) {}

  @Get()
  @RequireOrganization()
  @RequirePermission('agent.view')
  async list(
    @Query(new ZodValidationPipe(listAgentsQuery)) query: ListAgentsQuery,
    @CurrentContext() ctx: AuthenticatedRequestContext,
  ) {
    const res = await this.agents.list(ctx, { status: query.status, search: query.search, createdByUserId: query.createdByUserId }, query.limit, query.cursor);
    return { data: res.data, pagination: { cursor: query.cursor ?? null, nextCursor: res.nextCursor, hasNextPage: res.nextCursor !== null, limit: query.limit } };
  }

  @Post()
  @HttpCode(201)
  @RequireOrganization()
  @RequirePermission('agent.create')
  async create(
    @Body(new ZodValidationPipe(createAgentRequest)) body: CreateAgentRequest,
    @Headers('idempotency-key') key: string | undefined,
    @CurrentContext() ctx: AuthenticatedRequestContext,
  ) {
    return (await this.agents.create(ctx, body, requireIdempotencyKey(key))).body;
  }

  @Get(':agentId')
  @RequireOrganization()
  @RequirePermission('agent.view')
  get(@Param('agentId') agentId: string, @CurrentContext() ctx: AuthenticatedRequestContext) {
    return this.agents.get(ctx, agentId);
  }

  @Patch(':agentId')
  @RequireOrganization()
  @RequirePermission('agent.edit')
  update(
    @Param('agentId') agentId: string,
    @Body(new ZodValidationPipe(updateAgentRequest)) body: UpdateAgentRequest,
    @CurrentContext() ctx: AuthenticatedRequestContext,
  ) {
    return this.agents.update(ctx, agentId, body);
  }

  @Post(':agentId/suspend')
  @HttpCode(200)
  @RequireOrganization()
  @RequirePermission('agent.suspend')
  suspend(
    @Param('agentId') agentId: string,
    @Body(new ZodValidationPipe(agentCommandRequest)) body: AgentCommandRequest,
    @CurrentContext() ctx: AuthenticatedRequestContext,
  ) {
    return this.agents.transitionStatus(ctx, agentId, 'SUSPENDED', 'agent.suspended', body.expectedRevision, body.reason);
  }

  @Post(':agentId/reactivate')
  @HttpCode(200)
  @RequireOrganization()
  @RequirePermission('agent.suspend')
  reactivate(
    @Param('agentId') agentId: string,
    @Body(new ZodValidationPipe(agentCommandRequest)) body: AgentCommandRequest,
    @CurrentContext() ctx: AuthenticatedRequestContext,
  ) {
    return this.agents.transitionStatus(ctx, agentId, 'ACTIVE', 'agent.reactivated', body.expectedRevision, body.reason);
  }

  @Post(':agentId/revoke')
  @HttpCode(200)
  @RequireOrganization()
  @RequirePermission('agent.revoke')
  revoke(
    @Param('agentId') agentId: string,
    @Body(new ZodValidationPipe(agentCommandRequest)) body: AgentCommandRequest,
    @CurrentContext() ctx: AuthenticatedRequestContext,
  ) {
    return this.agents.transitionStatus(ctx, agentId, 'REVOKED', 'agent.revoked', body.expectedRevision, body.reason);
  }
}
