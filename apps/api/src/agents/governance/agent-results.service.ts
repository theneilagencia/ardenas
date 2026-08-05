/**
 * Arden.AS API — consultas administrativas de resultados/uso de agentes (ARDEN-BE-007.6 §24).
 * SOMENTE LEITURA, tenant-scoped, cursor. Nunca retorna conteúdo/segredo.
 */

import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { agentResultNotFound } from '../../common/errors/api-error';
import type { AuthenticatedRequestContext } from '../../identity/request-context';
import type {
  ListAgentResultsQuery,
  AgentUsageQuery,
  AgentOperationalResult,
  AgentUsageBucket,
  PaginatedResponse,
  PaginationMeta,
} from '@arden/contracts';
import { toOperationalResultContract, toUsageBucketContract } from './agent-results.serializers';

function encodeCursor(createdAt: Date, id: string): string {
  return Buffer.from(`${createdAt.toISOString()}|${id}`, 'utf8').toString('base64url');
}
function decodeCursor(cursor: string): { createdAt: Date; id: string } | null {
  try {
    const [at, id] = Buffer.from(cursor, 'base64url').toString('utf8').split('|');
    return at && id ? { createdAt: new Date(at), id } : null;
  } catch {
    return null;
  }
}

@Injectable()
export class AgentResultsService {
  constructor(private readonly prisma: PrismaService) {}

  private orgId(ctx: AuthenticatedRequestContext): string {
    return ctx.organizationId as string;
  }

  async listResults(ctx: AuthenticatedRequestContext, query: ListAgentResultsQuery): Promise<PaginatedResponse<AgentOperationalResult>> {
    const where: Prisma.AgentExecutionResultWhereInput = { organizationId: this.orgId(ctx) };
    if (query.status) where.status = query.status;
    if (query.evaluationStatus) where.evaluationStatus = query.evaluationStatus;
    if (query.governanceStatus) where.governanceStatus = query.governanceStatus;
    if (query.agentDefinitionId) where.agentDefinitionId = query.agentDefinitionId;
    if (query.agentVersionId) where.agentVersionId = query.agentVersionId;
    if (query.operationId) where.operationId = query.operationId;
    if (query.executionRunId) where.executionRunId = query.executionRunId;
    if (query.createdFrom || query.createdTo) {
      where.createdAt = { ...(query.createdFrom ? { gte: new Date(query.createdFrom) } : {}), ...(query.createdTo ? { lte: new Date(query.createdTo) } : {}) };
    }
    const cursor = query.cursor ? decodeCursor(query.cursor) : null;
    if (cursor) {
      where.AND = [{ OR: [{ createdAt: { lt: cursor.createdAt } }, { createdAt: cursor.createdAt, id: { lt: cursor.id } }] }];
    }
    const rows = await this.prisma.agentExecutionResult.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: query.limit + 1 });
    const hasNextPage = rows.length > query.limit;
    const page = hasNextPage ? rows.slice(0, query.limit) : rows;
    const last = page[page.length - 1];
    const pagination: PaginationMeta = { cursor: query.cursor ?? null, nextCursor: hasNextPage && last ? encodeCursor(last.createdAt, last.id) : null, hasNextPage, limit: query.limit };
    return { data: page.map(toOperationalResultContract), pagination };
  }

  async getResult(ctx: AuthenticatedRequestContext, resultId: string): Promise<{ data: AgentOperationalResult }> {
    const row = await this.prisma.agentExecutionResult.findFirst({ where: { id: resultId, organizationId: this.orgId(ctx) } });
    if (!row) throw agentResultNotFound();
    return { data: toOperationalResultContract(row) };
  }

  async usageSummary(ctx: AuthenticatedRequestContext, query: AgentUsageQuery): Promise<{ data: AgentUsageBucket[]; meta: { groupBy: AgentUsageQuery['groupBy']; periodFrom: string | null; periodTo: string | null } }> {
    const where: Prisma.AgentUsageRollupWhereInput = { organizationId: this.orgId(ctx), dimensionType: query.groupBy };
    if (query.providerKey) where.providerKey = query.providerKey;
    if (query.modelId) where.modelId = query.modelId;
    if (query.groupBy === 'AGENT_DEFINITION' && query.agentDefinitionId) where.dimensionId = query.agentDefinitionId;
    if (query.groupBy === 'OPERATION' && query.operationId) where.dimensionId = query.operationId;
    if (query.periodFrom || query.periodTo) {
      where.periodDate = { ...(query.periodFrom ? { gte: new Date(query.periodFrom) } : {}), ...(query.periodTo ? { lte: new Date(query.periodTo) } : {}) };
    }
    const rows = await this.prisma.agentUsageRollup.findMany({ where, orderBy: [{ periodDate: 'desc' }], take: 500 });
    return { data: rows.map(toUsageBucketContract), meta: { groupBy: query.groupBy, periodFrom: query.periodFrom ?? null, periodTo: query.periodTo ?? null } };
  }

  async executionUsage(ctx: AuthenticatedRequestContext, executionRunId: string): Promise<{ data: { executionRunId: string; results: AgentOperationalResult[] } }> {
    const rows = await this.prisma.agentExecutionResult.findMany({ where: { organizationId: this.orgId(ctx), executionRunId }, orderBy: [{ createdAt: 'asc' }] });
    return { data: { executionRunId, results: rows.map(toOperationalResultContract) } };
  }
}
