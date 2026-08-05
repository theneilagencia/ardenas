/**
 * Arden.AS API — serviço de versões de agente (ARDEN-BE-007.2).
 *
 * DRAFT editável (guardado por revisão); PUBLISHED/RETIRED imutáveis. Publicação
 * transacional e idempotente valida agente/tenant/config/provider/schemas/políticas,
 * calcula `contentHash` determinístico e atualiza o ponteiro publicado do agente.
 * Retirada da versão publicada atual limpa o ponteiro (não seleciona versão antiga).
 */

import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  agentContextPolicy,
  agentExecutionPolicy,
  agentToolPolicy,
  agentEvaluationPolicy,
  agentCostPolicy,
  type AgentVersion,
  type CreateAgentVersionRequest,
  type UpdateAgentVersionRequest,
  type PublishAgentVersionRequest,
  type RetireAgentVersionRequest,
  type AgentVersionDefinition,
} from '@arden/contracts';
import { PrismaService } from '../../database/prisma.service';
import { IdempotencyService } from '../../modules/idempotency/idempotency.service';
import { AuditRecorder } from '../../audit/audit.recorder';
import { runIdempotentCommand } from '../../operations/command.helpers';
import { assertRevision } from '../../common/concurrency/optimistic-concurrency';
import {
  validationError,
  versionConflict,
  alreadyPublished,
  agentNotFound,
  agentRevoked,
  agentVersionNotFound,
  agentVersionRetired,
  agentInputInvalid,
  modelConfigurationNotFound,
  modelConfigurationNotActive,
  modelProviderNotAvailable,
  modelProviderDisabled,
} from '../../common/errors/api-error';
import type { AuthenticatedRequestContext } from '../../identity/request-context';
import { AgentDefinitionsRepository } from '../agents/agent-definitions.repository';
import { AgentVersionsRepository } from './agent-versions.repository';
import { toAgentVersionContract } from '../agents.serializers';
import { computeAgentVersionContentHash } from './agent-content-hash';

function isProduction(): boolean {
  return (process.env.NODE_ENV ?? 'development') === 'production';
}

@Injectable()
export class AgentVersionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly agents: AgentDefinitionsRepository,
    private readonly repo: AgentVersionsRepository,
    private readonly idem: IdempotencyService,
    private readonly audit: AuditRecorder,
  ) {}

  private orgId(ctx: AuthenticatedRequestContext): string {
    return ctx.organizationId as string;
  }

  async list(ctx: AuthenticatedRequestContext, agentId: string, filters: { status?: string; versionNumber?: number }, limit: number, cursor?: string) {
    const orgId = this.orgId(ctx);
    const agent = await this.agents.findById(orgId, agentId);
    if (!agent) throw agentNotFound();
    const rows = await this.repo.list(orgId, agentId, filters, limit, cursor);
    const hasNext = rows.length > limit;
    const page = hasNext ? rows.slice(0, limit) : rows;
    return {
      data: page.map(toAgentVersionContract),
      nextCursor: hasNext && page.length ? page[page.length - 1].createdAt.toISOString() : null,
    };
  }

  async get(ctx: AuthenticatedRequestContext, agentId: string, versionId: string): Promise<{ data: AgentVersion }> {
    const row = await this.repo.findByIdForAgent(this.orgId(ctx), agentId, versionId);
    if (!row) throw agentVersionNotFound();
    return { data: toAgentVersionContract(row) };
  }

  async createDraft(ctx: AuthenticatedRequestContext, agentId: string, body: CreateAgentVersionRequest, idempotencyKey: string) {
    const orgId = this.orgId(ctx);
    const result = await runIdempotentCommand<{ data: AgentVersion }>(
      { idem: this.idem, prisma: this.prisma },
      { method: 'POST', path: `/organizations/${orgId}/agents/${agentId}/versions`, idempotencyKey, userId: ctx.userId, organizationId: orgId },
      body,
      201,
      async (tx) => {
        const agent = await this.agents.findById(orgId, agentId, tx);
        if (!agent) throw agentNotFound();
        if (agent.status === 'REVOKED') throw agentRevoked();

        const def = await this.resolveDraftDefinition(orgId, agentId, body, tx);
        await this.assertModelConfigurationInTenant(orgId, def.modelConfigurationId, tx);

        const versionNumber = (await this.repo.maxVersionNumber(agentId, tx)) + 1;
        const contentHash = computeAgentVersionContentHash(def);
        const created = await this.repo.create(
          {
            organizationId: orgId,
            agentDefinitionId: agentId,
            versionNumber,
            status: 'DRAFT',
            objective: def.objective,
            systemInstructions: def.systemInstructions,
            modelConfigurationId: def.modelConfigurationId,
            inputSchema: def.inputSchema as Prisma.InputJsonValue,
            outputSchema: def.outputSchema as Prisma.InputJsonValue,
            contextPolicy: def.contextPolicy as Prisma.InputJsonValue,
            executionPolicy: def.executionPolicy as Prisma.InputJsonValue,
            toolPolicy: def.toolPolicy as Prisma.InputJsonValue,
            evaluationPolicy: def.evaluationPolicy as Prisma.InputJsonValue,
            costPolicy: def.costPolicy as Prisma.InputJsonValue,
            contentHash,
            createdByUserId: ctx.userId,
            revision: 1,
          },
          tx,
        );
        await this.audit.record(tx, {
          organizationId: orgId, actorUserId: ctx.userId, action: 'agent_version.created',
          resourceType: 'agent_version', resourceId: created.id, correlationId: ctx.correlationId,
          after: { agentDefinitionId: agentId, versionNumber, status: created.status, contentHash }, metadata: {},
        });
        return { data: toAgentVersionContract(created) };
      },
    );
    return { statusCode: result.statusCode, body: result.response };
  }

  async updateDraft(ctx: AuthenticatedRequestContext, agentId: string, versionId: string, body: UpdateAgentVersionRequest): Promise<{ data: AgentVersion }> {
    const orgId = this.orgId(ctx);
    return this.prisma.$transaction(async (tx) => {
      const current = await this.repo.findByIdForAgent(orgId, agentId, versionId, tx);
      if (!current) throw agentVersionNotFound();
      if (current.status === 'PUBLISHED') throw alreadyPublished('Versão publicada é imutável.');
      if (current.status === 'RETIRED') throw agentVersionRetired();
      assertRevision({ resourceType: 'agent_version', resourceId: versionId, expectedRevision: body.expectedRevision, currentRevision: current.revision });
      const def = this.validateDefinition(body.definition);
      await this.assertModelConfigurationInTenant(orgId, def.modelConfigurationId, tx);
      const contentHash = computeAgentVersionContentHash(def);
      const count = await this.repo.updateGuarded(
        orgId, versionId, body.expectedRevision,
        {
          objective: def.objective, systemInstructions: def.systemInstructions, modelConfigurationId: def.modelConfigurationId,
          inputSchema: def.inputSchema as Prisma.InputJsonValue, outputSchema: def.outputSchema as Prisma.InputJsonValue,
          contextPolicy: def.contextPolicy as Prisma.InputJsonValue, executionPolicy: def.executionPolicy as Prisma.InputJsonValue,
          toolPolicy: def.toolPolicy as Prisma.InputJsonValue, evaluationPolicy: def.evaluationPolicy as Prisma.InputJsonValue,
          costPolicy: def.costPolicy as Prisma.InputJsonValue, contentHash,
        },
        tx,
      );
      if (count === 0) throw versionConflict({ resourceType: 'agent_version', resourceId: versionId, expectedRevision: body.expectedRevision, currentRevision: current.revision });
      await this.audit.record(tx, {
        organizationId: orgId, actorUserId: ctx.userId, action: 'agent_version.updated',
        resourceType: 'agent_version', resourceId: versionId, correlationId: ctx.correlationId,
        after: { versionNumber: current.versionNumber, contentHash }, metadata: {},
      });
      const fresh = await this.repo.findById(orgId, versionId, tx);
      return { data: toAgentVersionContract(fresh!) };
    });
  }

  async publish(ctx: AuthenticatedRequestContext, agentId: string, versionId: string, body: PublishAgentVersionRequest, idempotencyKey: string) {
    const orgId = this.orgId(ctx);
    const result = await runIdempotentCommand<{ data: AgentVersion }>(
      { idem: this.idem, prisma: this.prisma },
      { method: 'POST', path: `/organizations/${orgId}/agents/${agentId}/versions/${versionId}/publish`, idempotencyKey, userId: ctx.userId, organizationId: orgId },
      body,
      200,
      async (tx) => {
        const agent = await this.agents.findById(orgId, agentId, tx);
        if (!agent) throw agentNotFound();
        if (agent.status === 'REVOKED') throw agentRevoked();
        const version = await this.repo.findByIdForAgent(orgId, agentId, versionId, tx);
        if (!version) throw agentVersionNotFound();
        if (version.status === 'PUBLISHED') throw alreadyPublished();
        if (version.status === 'RETIRED') throw agentVersionRetired();
        assertRevision({ resourceType: 'agent_version', resourceId: versionId, expectedRevision: body.expectedRevision, currentRevision: version.revision });

        // Validação de publicação (§20): config ACTIVE + provider ACTIVE/permitido + conteúdo coerente.
        const config = await tx.modelConfiguration.findFirst({ where: { id: version.modelConfigurationId, organizationId: orgId } });
        if (!config) throw modelConfigurationNotFound();
        if (config.status !== 'ACTIVE') throw modelConfigurationNotActive();
        const provider = await tx.modelProviderDefinition.findUnique({ where: { id: config.providerDefinitionId } });
        if (!provider) throw modelProviderNotAvailable();
        if (provider.status !== 'ACTIVE') throw modelProviderDisabled();
        if (isProduction() && !provider.productionAllowed) throw modelProviderDisabled('Provider não permitido em produção.');
        this.assertPublishableContent(version);

        const contentHash = computeAgentVersionContentHash({
          objective: version.objective, systemInstructions: version.systemInstructions, modelConfigurationId: version.modelConfigurationId,
          inputSchema: version.inputSchema, outputSchema: version.outputSchema, contextPolicy: version.contextPolicy,
          executionPolicy: version.executionPolicy, toolPolicy: version.toolPolicy, evaluationPolicy: version.evaluationPolicy, costPolicy: version.costPolicy,
        });

        // Transição guardada por revisão E por status=DRAFT — só uma publicação concorrente vence.
        const transitioned = await this.repo.transitionGuarded(orgId, versionId, body.expectedRevision, 'DRAFT', { status: 'PUBLISHED', publishedAt: new Date(), contentHash }, tx);
        if (transitioned === 0) throw versionConflict({ resourceType: 'agent_version', resourceId: versionId, expectedRevision: body.expectedRevision, currentRevision: version.revision });

        // Ponteiro do agente → esta versão; DRAFT→ACTIVE na primeira publicação.
        const pointer = await this.agents.publishPointerGuarded(orgId, agentId, agent.revision, { currentPublishedVersionId: versionId, status: agent.status === 'DRAFT' ? 'ACTIVE' : undefined }, tx);
        if (pointer === 0) throw versionConflict({ resourceType: 'agent_definition', resourceId: agentId, expectedRevision: agent.revision, currentRevision: agent.revision });

        await this.audit.record(tx, {
          organizationId: orgId, actorUserId: ctx.userId, action: 'agent_version.published',
          resourceType: 'agent_version', resourceId: versionId, correlationId: ctx.correlationId,
          before: { status: 'DRAFT' }, after: { status: 'PUBLISHED', versionNumber: version.versionNumber, contentHash },
          metadata: { changeSummary: body.changeSummary },
        });
        const fresh = await this.repo.findById(orgId, versionId, tx);
        return { data: toAgentVersionContract(fresh!) };
      },
    );
    return { statusCode: result.statusCode, body: result.response };
  }

  async retire(ctx: AuthenticatedRequestContext, agentId: string, versionId: string, body: RetireAgentVersionRequest, idempotencyKey: string) {
    const orgId = this.orgId(ctx);
    const result = await runIdempotentCommand<{ data: AgentVersion }>(
      { idem: this.idem, prisma: this.prisma },
      { method: 'POST', path: `/organizations/${orgId}/agents/${agentId}/versions/${versionId}/retire`, idempotencyKey, userId: ctx.userId, organizationId: orgId },
      body,
      200,
      async (tx) => {
        const agent = await this.agents.findById(orgId, agentId, tx);
        if (!agent) throw agentNotFound();
        const version = await this.repo.findByIdForAgent(orgId, agentId, versionId, tx);
        if (!version) throw agentVersionNotFound();
        if (version.status === 'RETIRED') throw agentVersionRetired();
        assertRevision({ resourceType: 'agent_version', resourceId: versionId, expectedRevision: body.expectedRevision, currentRevision: version.revision });

        const transitioned = await this.repo.transitionGuarded(orgId, versionId, body.expectedRevision, version.status, { status: 'RETIRED', retiredAt: new Date() }, tx);
        if (transitioned === 0) throw versionConflict({ resourceType: 'agent_version', resourceId: versionId, expectedRevision: body.expectedRevision, currentRevision: version.revision });

        // Se era a versão publicada atual, limpa o ponteiro (não seleciona versão antiga).
        if (agent.currentPublishedVersionId === versionId) {
          const cleared = await this.agents.clearPublishedPointerGuarded(orgId, agentId, agent.revision, tx);
          if (cleared === 0) throw versionConflict({ resourceType: 'agent_definition', resourceId: agentId, expectedRevision: agent.revision, currentRevision: agent.revision });
        }
        await this.audit.record(tx, {
          organizationId: orgId, actorUserId: ctx.userId, action: 'agent_version.retired',
          resourceType: 'agent_version', resourceId: versionId, correlationId: ctx.correlationId,
          before: { status: version.status }, after: { status: 'RETIRED' }, metadata: body.reason ? { reason: body.reason } : {},
        });
        const fresh = await this.repo.findById(orgId, versionId, tx);
        return { data: toAgentVersionContract(fresh!) };
      },
    );
    return { statusCode: result.statusCode, body: result.response };
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────
  /** Deriva a definição do rascunho de `definition` (prioritário) ou de `basedOnVersionId`. */
  private async resolveDraftDefinition(
    orgId: string,
    agentId: string,
    body: CreateAgentVersionRequest,
    tx: Prisma.TransactionClient,
  ): Promise<AgentVersionDefinition> {
    if (body.definition) return this.validateDefinition(body.definition);
    if (body.basedOnVersionId) {
      const base = await this.repo.findByIdForAgent(orgId, agentId, body.basedOnVersionId, tx);
      if (!base) throw agentVersionNotFound();
      return this.validateDefinition({
        objective: base.objective, systemInstructions: base.systemInstructions, modelConfigurationId: base.modelConfigurationId,
        inputSchema: base.inputSchema as Record<string, unknown>, outputSchema: base.outputSchema as Record<string, unknown>,
        contextPolicy: base.contextPolicy as AgentVersionDefinition['contextPolicy'],
        executionPolicy: base.executionPolicy as AgentVersionDefinition['executionPolicy'],
        toolPolicy: base.toolPolicy as AgentVersionDefinition['toolPolicy'],
        evaluationPolicy: base.evaluationPolicy as AgentVersionDefinition['evaluationPolicy'],
        costPolicy: base.costPolicy as AgentVersionDefinition['costPolicy'],
      });
    }
    throw validationError(
      [{ field: 'definition', code: 'DEFINITION_REQUIRED', message: 'Informe definition ou basedOnVersionId.' }],
      'Definição da versão obrigatória.',
    );
  }

  /** Revalida as políticas contra os contratos (coerência interna; sem afirmar resolução de tools). */
  private validateDefinition(def: AgentVersionDefinition | undefined): AgentVersionDefinition {
    if (!def) {
      throw validationError([{ field: 'definition', code: 'DEFINITION_REQUIRED', message: 'Definição da versão obrigatória.' }], 'Definição da versão obrigatória.');
    }
    const problems: { field: string; code: string; message: string }[] = [];
    const checks: [string, { safeParse: (v: unknown) => { success: boolean } }][] = [
      ['contextPolicy', agentContextPolicy],
      ['executionPolicy', agentExecutionPolicy],
      ['toolPolicy', agentToolPolicy],
      ['evaluationPolicy', agentEvaluationPolicy],
      ['costPolicy', agentCostPolicy],
    ];
    for (const [field, schema] of checks) {
      if (!schema.safeParse((def as Record<string, unknown>)[field]).success) {
        problems.push({ field, code: 'POLICY_INVALID', message: `Política ${field} inválida.` });
      }
    }
    if (!def.objective || def.objective.trim().length === 0) problems.push({ field: 'objective', code: 'REQUIRED', message: 'objective obrigatório.' });
    if (!def.systemInstructions || def.systemInstructions.length > 20_000) problems.push({ field: 'systemInstructions', code: 'RANGE', message: 'systemInstructions obrigatório e ≤ 20000.' });
    if (problems.length > 0) throw agentInputInvalid(problems);
    return def;
  }

  /** Valida coerência final antes de publicar (schemas objeto; políticas válidas). */
  private assertPublishableContent(version: {
    objective: string; systemInstructions: string; inputSchema: unknown; outputSchema: unknown;
    contextPolicy: unknown; executionPolicy: unknown; toolPolicy: unknown; evaluationPolicy: unknown; costPolicy: unknown;
  }): void {
    this.validateDefinition({
      objective: version.objective, systemInstructions: version.systemInstructions,
      modelConfigurationId: '00000000-0000-0000-0000-000000000000',
      inputSchema: (version.inputSchema ?? {}) as Record<string, unknown>,
      outputSchema: (version.outputSchema ?? {}) as Record<string, unknown>,
      contextPolicy: version.contextPolicy as AgentVersionDefinition['contextPolicy'],
      executionPolicy: version.executionPolicy as AgentVersionDefinition['executionPolicy'],
      toolPolicy: version.toolPolicy as AgentVersionDefinition['toolPolicy'],
      evaluationPolicy: version.evaluationPolicy as AgentVersionDefinition['evaluationPolicy'],
      costPolicy: version.costPolicy as AgentVersionDefinition['costPolicy'],
    });
  }

  private async assertModelConfigurationInTenant(orgId: string, modelConfigurationId: string, tx: Prisma.TransactionClient): Promise<void> {
    const cfg = await tx.modelConfiguration.findFirst({ where: { id: modelConfigurationId, organizationId: orgId }, select: { id: true } });
    if (!cfg) throw modelConfigurationNotFound('Configuração de modelo não encontrada no tenant.');
  }
}
