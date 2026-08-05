/**
 * Arden.AS API — serviço administrativo de configurações de modelo (ARDEN-BE-007.2).
 *
 * Tenant-scoped. Sem runtime de LLM, sem segredo persistido. Idempotência + revisão +
 * state machine + auditoria sanitizada. Provider de teste não pode ser ATIVADO em
 * produção. `credentialConnectionId` deve pertencer ao mesmo tenant.
 */

import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type {
  ModelConfiguration,
  ModelConfigurationStatus,
  CreateModelConfigurationRequest,
  UpdateModelConfigurationRequest,
} from '@arden/contracts';
import { PrismaService } from '../../database/prisma.service';
import { IdempotencyService } from '../../modules/idempotency/idempotency.service';
import { AuditRecorder } from '../../audit/audit.recorder';
import { runIdempotentCommand } from '../../operations/command.helpers';
import { assertRevision } from '../../common/concurrency/optimistic-concurrency';
import {
  notFound,
  versionConflict,
  invalidStateTransition,
  modelProviderNotAvailable,
  modelProviderDisabled,
  modelConfigurationNotFound,
} from '../../common/errors/api-error';
import type { AuthenticatedRequestContext } from '../../identity/request-context';
import {
  canTransitionModelConfiguration,
  isModelConfigurationTerminal,
} from '../agent.state-machines';
import { ModelConfigurationsRepository } from './model-configurations.repository';
import { ModelProviderDefinitionsRepository } from '../providers/model-providers.repository';
import { AnthropicConfigurationValidationService } from './anthropic-configuration-validation.service';
import { toModelConfigurationContract } from '../agents.serializers';

function isProduction(): boolean {
  return (process.env.NODE_ENV ?? 'development') === 'production';
}

@Injectable()
export class ModelConfigurationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repo: ModelConfigurationsRepository,
    private readonly providers: ModelProviderDefinitionsRepository,
    private readonly anthropicValidation: AnthropicConfigurationValidationService,
    private readonly idem: IdempotencyService,
    private readonly audit: AuditRecorder,
  ) {}

  private orgId(ctx: AuthenticatedRequestContext): string {
    return ctx.organizationId as string;
  }

  async list(ctx: AuthenticatedRequestContext, filters: { providerKey?: string; status?: string; modelId?: string; search?: string }, limit: number, cursor?: string) {
    const orgId = this.orgId(ctx);
    let providerDefinitionId: string | undefined;
    if (filters.providerKey) {
      const p = await this.providers.findByKeyLatest(filters.providerKey);
      // Filtro por provider inexistente → resultado vazio (não vaza enumeração).
      providerDefinitionId = p?.id ?? '00000000-0000-0000-0000-000000000000';
    }
    const rows = await this.repo.list(orgId, { status: filters.status, providerDefinitionId, modelId: filters.modelId, search: filters.search }, limit, cursor);
    const hasNext = rows.length > limit;
    const page = hasNext ? rows.slice(0, limit) : rows;
    const providerMap = await this.providerMap(page.map((r) => r.providerDefinitionId));
    return {
      data: page.map((r) => toModelConfigurationContract(r, providerMap.get(r.providerDefinitionId)!)),
      nextCursor: hasNext && page.length ? page[page.length - 1].createdAt.toISOString() : null,
    };
  }

  async get(ctx: AuthenticatedRequestContext, id: string): Promise<{ data: ModelConfiguration }> {
    const orgId = this.orgId(ctx);
    const row = await this.repo.findById(orgId, id);
    if (!row) throw modelConfigurationNotFound();
    const provider = await this.providers.findById(row.providerDefinitionId);
    if (!provider) throw modelProviderNotAvailable();
    return { data: toModelConfigurationContract(row, provider) };
  }

  async create(ctx: AuthenticatedRequestContext, body: CreateModelConfigurationRequest, idempotencyKey: string) {
    const orgId = this.orgId(ctx);
    const result = await runIdempotentCommand<{ data: ModelConfiguration }>(
      { idem: this.idem, prisma: this.prisma },
      { method: 'POST', path: `/organizations/${orgId}/model-configurations`, idempotencyKey, userId: ctx.userId, organizationId: orgId },
      body,
      201,
      async (tx) => {
        const provider = await this.providers.findByKeyAndVersion(body.providerKey, body.providerVersion, tx);
        if (!provider) throw modelProviderNotAvailable();
        // Preparação (ARDEN-BE-008.2 §24): um DRAFT pode ser preparado contra um provider
        // catalogado porém DISABLED (ex.: anthropic.direct). A ATIVAÇÃO permanece bloqueada
        // (transitionStatus exige provider ACTIVE). DEPRECATED não permite nem preparação.
        if (provider.status === 'DEPRECATED') throw modelProviderDisabled();
        // Validação específica do provider (§25): Anthropic exige modelId allowlisted e
        // parâmetros estritos (rejeita apiKey/baseUrl/model/headers/tools/system/etc.).
        this.anthropicValidation.validate(provider.key, body.modelId, body.parameters);
        if (body.credentialConnectionId) await this.assertConnectionInTenant(orgId, body.credentialConnectionId, tx);
        const created = await this.repo.create(
          {
            organizationId: orgId,
            providerDefinitionId: provider.id,
            name: body.name,
            description: body.description ?? null,
            modelId: body.modelId,
            credentialConnectionId: body.credentialConnectionId ?? null,
            parameters: body.parameters,
            status: 'DRAFT',
            createdByUserId: ctx.userId,
            revision: 1,
          },
          tx,
        );
        await this.audit.record(tx, {
          organizationId: orgId, actorUserId: ctx.userId, action: 'model_configuration.created',
          resourceType: 'model_configuration', resourceId: created.id, correlationId: ctx.correlationId,
          after: { name: created.name, status: created.status, providerKey: provider.key, modelId: created.modelId }, metadata: {},
        });
        return { data: toModelConfigurationContract(created, provider) };
      },
    );
    return { statusCode: result.statusCode, body: result.response };
  }

  async update(ctx: AuthenticatedRequestContext, id: string, body: UpdateModelConfigurationRequest): Promise<{ data: ModelConfiguration }> {
    const orgId = this.orgId(ctx);
    return this.prisma.$transaction(async (tx) => {
      const current = await this.repo.findById(orgId, id, tx);
      if (!current) throw modelConfigurationNotFound();
      if (isModelConfigurationTerminal(current.status)) throw invalidStateTransition('Configuração revogada é imutável.');
      assertRevision({ resourceType: 'model_configuration', resourceId: id, expectedRevision: body.expectedRevision, currentRevision: current.revision });
      // Revalida modelId/parameters efetivos para o provider (§25) quando algum muda.
      if (body.modelId !== undefined || body.parameters !== undefined) {
        const providerNow = await this.providers.findById(current.providerDefinitionId, tx);
        if (providerNow) {
          this.anthropicValidation.validate(providerNow.key, body.modelId ?? current.modelId, body.parameters ?? current.parameters);
        }
      }
      if (body.credentialConnectionId) await this.assertConnectionInTenant(orgId, body.credentialConnectionId, tx);
      const data: Record<string, unknown> = {};
      if (body.name !== undefined) data.name = body.name;
      if (body.description !== undefined) data.description = body.description;
      if (body.modelId !== undefined) data.modelId = body.modelId;
      if (body.credentialConnectionId !== undefined) data.credentialConnectionId = body.credentialConnectionId;
      if (body.parameters !== undefined) data.parameters = body.parameters;
      const count = await this.repo.updateGuarded(orgId, id, body.expectedRevision, data, tx);
      if (count === 0) throw versionConflict({ resourceType: 'model_configuration', resourceId: id, expectedRevision: body.expectedRevision, currentRevision: current.revision });
      const fresh = await this.repo.findById(orgId, id, tx);
      const provider = await this.providers.findById(fresh!.providerDefinitionId, tx);
      await this.audit.record(tx, {
        organizationId: orgId, actorUserId: ctx.userId, action: 'model_configuration.updated',
        resourceType: 'model_configuration', resourceId: id, correlationId: ctx.correlationId,
        after: { name: fresh!.name, modelId: fresh!.modelId }, metadata: {},
      });
      return { data: toModelConfigurationContract(fresh!, provider!) };
    });
  }

  async transitionStatus(ctx: AuthenticatedRequestContext, id: string, target: ModelConfigurationStatus, action: string, expectedRevision: number, reason?: string): Promise<{ data: ModelConfiguration }> {
    const orgId = this.orgId(ctx);
    return this.prisma.$transaction(async (tx) => {
      const current = await this.repo.findById(orgId, id, tx);
      if (!current) throw modelConfigurationNotFound();
      assertRevision({ resourceType: 'model_configuration', resourceId: id, expectedRevision, currentRevision: current.revision });
      if (isModelConfigurationTerminal(current.status)) throw invalidStateTransition('Configuração revogada é terminal.');
      if (!canTransitionModelConfiguration(current.status, target)) throw invalidStateTransition(`Transição inválida ${current.status} → ${target}.`);
      const provider = await this.providers.findById(current.providerDefinitionId, tx);
      if (!provider) throw modelProviderNotAvailable();
      // Ativar exige provider ACTIVE e, em produção, permitido em produção.
      if (target === 'ACTIVE') {
        if (provider.status !== 'ACTIVE') throw modelProviderDisabled();
        if (isProduction() && !provider.productionAllowed) throw modelProviderDisabled('Provider não permitido em produção.');
      }
      const count = await this.repo.updateGuarded(orgId, id, expectedRevision, { status: target }, tx);
      if (count === 0) throw versionConflict({ resourceType: 'model_configuration', resourceId: id, expectedRevision, currentRevision: current.revision });
      await this.audit.record(tx, {
        organizationId: orgId, actorUserId: ctx.userId, action,
        resourceType: 'model_configuration', resourceId: id, correlationId: ctx.correlationId,
        before: { status: current.status }, after: { status: target }, metadata: reason ? { reason } : {},
      });
      const fresh = await this.repo.findById(orgId, id, tx);
      return { data: toModelConfigurationContract(fresh!, provider) };
    });
  }

  private async assertConnectionInTenant(organizationId: string, connectionId: string, tx: Prisma.TransactionClient): Promise<void> {
    const conn = await tx.organizationConnection.findFirst({ where: { id: connectionId, organizationId }, select: { id: true } });
    if (!conn) throw notFound('Conexão de credencial não encontrada no tenant.');
  }

  private async providerMap(ids: string[]): Promise<Map<string, { key: string; version: string }>> {
    const map = new Map<string, { key: string; version: string }>();
    for (const id of new Set(ids)) {
      const p = await this.providers.findById(id);
      if (p) map.set(id, { key: p.key, version: p.version });
    }
    return map;
  }
}
