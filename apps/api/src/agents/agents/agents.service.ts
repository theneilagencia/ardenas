/**
 * Arden.AS API — serviço administrativo de definições de agente (ARDEN-BE-007.2).
 * Tenant-scoped. Idempotência + revisão + state machine + auditoria. Sem prompt,
 * modelId, provider ou segredo na definição.
 */

import { Injectable } from '@nestjs/common';
import type {
  AgentDefinition,
  AgentStatus,
  CreateAgentRequest,
  UpdateAgentRequest,
} from '@arden/contracts';
import { PrismaService } from '../../database/prisma.service';
import { IdempotencyService } from '../../modules/idempotency/idempotency.service';
import { AuditRecorder } from '../../audit/audit.recorder';
import { runIdempotentCommand } from '../../operations/command.helpers';
import { assertRevision } from '../../common/concurrency/optimistic-concurrency';
import {
  versionConflict,
  invalidStateTransition,
  resourceConflict,
  agentNotFound,
  agentRevoked,
} from '../../common/errors/api-error';
import type { AuthenticatedRequestContext } from '../../identity/request-context';
import { canTransitionAgent, isAgentTerminal } from '../agent.state-machines';
import { AgentDefinitionsRepository } from './agent-definitions.repository';
import { toAgentDefinitionContract } from '../agents.serializers';

@Injectable()
export class AgentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repo: AgentDefinitionsRepository,
    private readonly idem: IdempotencyService,
    private readonly audit: AuditRecorder,
  ) {}

  private orgId(ctx: AuthenticatedRequestContext): string {
    return ctx.organizationId as string;
  }

  async list(ctx: AuthenticatedRequestContext, filters: { status?: string; search?: string; createdByUserId?: string }, limit: number, cursor?: string) {
    const orgId = this.orgId(ctx);
    const rows = await this.repo.list(orgId, filters, limit, cursor);
    const hasNext = rows.length > limit;
    const page = hasNext ? rows.slice(0, limit) : rows;
    return {
      data: page.map(toAgentDefinitionContract),
      nextCursor: hasNext && page.length ? page[page.length - 1].createdAt.toISOString() : null,
    };
  }

  async get(ctx: AuthenticatedRequestContext, id: string): Promise<{ data: AgentDefinition }> {
    const row = await this.repo.findById(this.orgId(ctx), id);
    if (!row) throw agentNotFound();
    return { data: toAgentDefinitionContract(row) };
  }

  async create(ctx: AuthenticatedRequestContext, body: CreateAgentRequest, idempotencyKey: string) {
    const orgId = this.orgId(ctx);
    const result = await runIdempotentCommand<{ data: AgentDefinition }>(
      { idem: this.idem, prisma: this.prisma },
      { method: 'POST', path: `/organizations/${orgId}/agents`, idempotencyKey, userId: ctx.userId, organizationId: orgId },
      body,
      201,
      async (tx) => {
        const existing = await this.repo.findByKey(orgId, body.key, tx);
        if (existing) throw resourceConflict('Já existe um agente com esta key na organização.');
        const created = await this.repo.create(
          {
            organizationId: orgId,
            key: body.key,
            name: body.name,
            description: body.description ?? null,
            status: 'DRAFT',
            createdByUserId: ctx.userId,
            revision: 1,
          },
          tx,
        );
        await this.audit.record(tx, {
          organizationId: orgId, actorUserId: ctx.userId, action: 'agent.created',
          resourceType: 'agent_definition', resourceId: created.id, correlationId: ctx.correlationId,
          after: { key: created.key, name: created.name, status: created.status }, metadata: {},
        });
        return { data: toAgentDefinitionContract(created) };
      },
    );
    return { statusCode: result.statusCode, body: result.response };
  }

  async update(ctx: AuthenticatedRequestContext, id: string, body: UpdateAgentRequest): Promise<{ data: AgentDefinition }> {
    const orgId = this.orgId(ctx);
    return this.prisma.$transaction(async (tx) => {
      const current = await this.repo.findById(orgId, id, tx);
      if (!current) throw agentNotFound();
      if (isAgentTerminal(current.status)) throw agentRevoked();
      assertRevision({ resourceType: 'agent_definition', resourceId: id, expectedRevision: body.expectedRevision, currentRevision: current.revision });
      const data: Record<string, unknown> = {};
      if (body.name !== undefined) data.name = body.name;
      if (body.description !== undefined) data.description = body.description;
      const count = await this.repo.updateGuarded(orgId, id, body.expectedRevision, data, tx);
      if (count === 0) throw versionConflict({ resourceType: 'agent_definition', resourceId: id, expectedRevision: body.expectedRevision, currentRevision: current.revision });
      await this.audit.record(tx, {
        organizationId: orgId, actorUserId: ctx.userId, action: 'agent.updated',
        resourceType: 'agent_definition', resourceId: id, correlationId: ctx.correlationId,
        after: { name: body.name ?? current.name }, metadata: {},
      });
      const fresh = await this.repo.findById(orgId, id, tx);
      return { data: toAgentDefinitionContract(fresh!) };
    });
  }

  async transitionStatus(ctx: AuthenticatedRequestContext, id: string, target: AgentStatus, action: string, expectedRevision: number, reason?: string): Promise<{ data: AgentDefinition }> {
    const orgId = this.orgId(ctx);
    return this.prisma.$transaction(async (tx) => {
      const current = await this.repo.findById(orgId, id, tx);
      if (!current) throw agentNotFound();
      assertRevision({ resourceType: 'agent_definition', resourceId: id, expectedRevision, currentRevision: current.revision });
      if (isAgentTerminal(current.status)) throw agentRevoked();
      if (!canTransitionAgent(current.status, target)) throw invalidStateTransition(`Transição inválida ${current.status} → ${target}.`);
      const count = await this.repo.updateGuarded(orgId, id, expectedRevision, { status: target }, tx);
      if (count === 0) throw versionConflict({ resourceType: 'agent_definition', resourceId: id, expectedRevision, currentRevision: current.revision });
      await this.audit.record(tx, {
        organizationId: orgId, actorUserId: ctx.userId, action,
        resourceType: 'agent_definition', resourceId: id, correlationId: ctx.correlationId,
        before: { status: current.status }, after: { status: target }, metadata: reason ? { reason } : {},
      });
      const fresh = await this.repo.findById(orgId, id, tx);
      return { data: toAgentDefinitionContract(fresh!) };
    });
  }
}
