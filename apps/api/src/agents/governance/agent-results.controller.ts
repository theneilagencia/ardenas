/**
 * Arden.AS API — endpoints administrativos de resultados/uso de agentes (ARDEN-BE-007.6 §24).
 * Tenant no path; SOMENTE LEITURA; autorização por permissão. Sem execução direta.
 */

import { Controller, Get, Param, Query } from '@nestjs/common';
import { listAgentResultsQuery, agentUsageQuery, type ListAgentResultsQuery, type AgentUsageQuery } from '@arden/contracts';
import { RequireOrganization, RequirePermission } from '../../authz/decorators';
import { CurrentContext, type AuthenticatedRequestContext } from '../../identity/request-context';
import { ZodValidationPipe } from '../../common/validation/zod-validation.pipe';
import { AgentResultsService } from './agent-results.service';

@Controller('organizations/:organizationId')
export class AgentResultsController {
  constructor(private readonly results: AgentResultsService) {}

  @Get('agent-execution-results')
  @RequireOrganization()
  @RequirePermission('agent.view')
  async list(@CurrentContext() ctx: AuthenticatedRequestContext, @Query(new ZodValidationPipe(listAgentResultsQuery)) query: ListAgentResultsQuery) {
    return this.results.listResults(ctx, query);
  }

  @Get('agent-execution-results/:resultId')
  @RequireOrganization()
  @RequirePermission('agent.view')
  async get(@CurrentContext() ctx: AuthenticatedRequestContext, @Param('resultId') resultId: string) {
    return this.results.getResult(ctx, resultId);
  }

  @Get('agent-usage')
  @RequireOrganization()
  @RequirePermission('agent.cost.view')
  async usage(@CurrentContext() ctx: AuthenticatedRequestContext, @Query(new ZodValidationPipe(agentUsageQuery)) query: AgentUsageQuery) {
    return this.results.usageSummary(ctx, query);
  }

  @Get('executions/:executionRunId/agent-usage')
  @RequireOrganization()
  @RequirePermission('agent.view')
  async executionUsage(@CurrentContext() ctx: AuthenticatedRequestContext, @Param('executionRunId') executionRunId: string) {
    return this.results.executionUsage(ctx, executionRunId);
  }
}
