/**
 * Arden.AS API — serviço de persistência de tool bindings (ARDEN-BE-006.3).
 *
 * TENANT-SCOPED. Valida compatibilidade conector↔ferramenta↔conexão, tenant de
 * operação/versão, alias único e action keys aprovadas. Concorrência por revision,
 * idempotência reutilizada, auditoria imutável. Operation binding é removido
 * LOGICAMENTE (§18). Sem segredo.
 */

import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  externalActionKey,
  type CreateOrganizationToolBindingRequest, type UpdateOrganizationToolBindingRequest,
  type CreateOperationToolBindingRequest, type UpdateOperationToolBindingRequest,
  type OrganizationToolBinding, type OperationToolBinding, type ListToolBindingsQuery, type PaginationMeta,
} from '@arden/contracts';
import { PrismaService } from '../../database/prisma.service';
import { IdempotencyService } from '../../modules/idempotency/idempotency.service';
import { AuditRecorder } from '../../audit/audit.recorder';
import { runIdempotentCommand } from '../../operations/command.helpers';
import { assertRevision } from '../../common/concurrency/optimistic-concurrency';
import type { AuthenticatedRequestContext } from '../../identity/request-context';
import {
  notFound, connectionRevoked, toolNotAvailable, toolBindingNotFound, resourceConflict, versionConflict, validationError,
} from '../../common/errors/api-error';
import { OrganizationConnectionsRepository } from '../connections/connections.repository';
import { ConnectorToolDefinitionsRepository } from '../catalog/catalog.repository';
import { OrganizationToolBindingsRepository, OperationToolBindingsRepository } from './tool-bindings.repository';
import { toOrgToolBindingContract, toOperationToolBindingContract } from '../connectors.serializers';

const KNOWN_ACTION_KEYS = new Set<string>(externalActionKey.options);

@Injectable()
export class ToolBindingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly connections: OrganizationConnectionsRepository,
    private readonly tools: ConnectorToolDefinitionsRepository,
    private readonly orgBindings: OrganizationToolBindingsRepository,
    private readonly opBindings: OperationToolBindingsRepository,
    private readonly idem: IdempotencyService,
    private readonly audit: AuditRecorder,
  ) {}

  private orgId(ctx: AuthenticatedRequestContext): string {
    return ctx.organizationId as string;
  }

  // ── Organization tool binding ─────────────────────────────────────────────────
  private async toolKeyVersion(tx: Prisma.TransactionClient | PrismaService, connectorToolDefinitionId: string): Promise<{ key: string; version: string }> {
    const tool = await tx.connectorToolDefinition.findUnique({ where: { id: connectorToolDefinitionId }, select: { key: true, version: true } });
    return { key: tool?.key ?? '', version: tool?.version ?? '' };
  }

  async listOrgBindings(ctx: AuthenticatedRequestContext, query: ListToolBindingsQuery): Promise<{ data: OrganizationToolBinding[]; pagination: PaginationMeta }> {
    const orgId = this.orgId(ctx);
    const rows = await this.orgBindings.list(orgId, { connectionId: query.connectionId, enabled: query.enabled }, query.limit + 1, query.cursor);
    const hasNextPage = rows.length > query.limit;
    const page = hasNextPage ? rows.slice(0, query.limit) : rows;
    const last = page[page.length - 1];
    const data = await Promise.all(page.map(async (row) => {
      const t = await this.toolKeyVersion(this.prisma, row.connectorToolDefinitionId);
      return toOrgToolBindingContract(row, t.key, t.version);
    }));
    return { data, pagination: { cursor: query.cursor ?? null, nextCursor: hasNextPage && last ? last.createdAt.toISOString() : null, hasNextPage, limit: query.limit } };
  }

  async getOrgBinding(ctx: AuthenticatedRequestContext, id: string): Promise<{ data: OrganizationToolBinding }> {
    const orgId = this.orgId(ctx);
    const row = await this.orgBindings.findById(orgId, id);
    if (!row) throw toolBindingNotFound();
    const t = await this.toolKeyVersion(this.prisma, row.connectorToolDefinitionId);
    return { data: toOrgToolBindingContract(row, t.key, t.version) };
  }

  async createOrgBinding(ctx: AuthenticatedRequestContext, body: CreateOrganizationToolBindingRequest, idempotencyKey: string): Promise<{ statusCode: number; body: { data: OrganizationToolBinding } }> {
    const orgId = this.orgId(ctx);
    const result = await runIdempotentCommand<{ data: OrganizationToolBinding }>(
      { idem: this.idem, prisma: this.prisma },
      { method: 'POST', path: `/organizations/${orgId}/tool-bindings`, idempotencyKey, userId: ctx.userId, organizationId: orgId },
      body, 201,
      async (tx) => {
        const conn = await this.connections.findById(orgId, body.connectionId, tx);
        if (!conn) throw notFound('Conexão não encontrada.');
        if (conn.status === 'REVOKED') throw connectionRevoked('Conexão revogada não aceita vínculo.');
        const tool = await this.tools.findByConnectorAndKey(conn.connectorDefinitionId, body.connectorToolKey, body.connectorToolVersion, tx);
        if (!tool || !tool.active) throw toolNotAvailable('Ferramenta incompatível com o conector da conexão.');
        const created = await this.orgBindings.create({
          organizationId: orgId, connectionId: body.connectionId, connectorToolDefinitionId: tool.id,
          name: body.name, enabled: true,
          configurationOverrides: (body.configurationOverrides ?? {}) as Prisma.InputJsonValue,
          policyOverrides: (body.policyOverrides ?? {}) as Prisma.InputJsonValue,
          createdByUserId: ctx.userId, revision: 1,
        }, tx);
        await this.audit.record(tx, { organizationId: orgId, actorUserId: ctx.userId, action: 'tool_binding.created', resourceType: 'organization_tool_binding', resourceId: created.id, correlationId: ctx.correlationId, after: { name: created.name, toolKey: tool.key }, metadata: {} });
        return { data: toOrgToolBindingContract(created, tool.key, tool.version) };
      },
    );
    return { statusCode: result.statusCode, body: result.response };
  }

  async updateOrgBinding(ctx: AuthenticatedRequestContext, id: string, body: UpdateOrganizationToolBindingRequest): Promise<{ data: OrganizationToolBinding }> {
    const orgId = this.orgId(ctx);
    const { row, tool } = await this.prisma.$transaction(async (tx) => {
      const current = await this.orgBindings.findById(orgId, id, tx);
      if (!current) throw toolBindingNotFound();
      assertRevision({ resourceType: 'organization_tool_binding', resourceId: id, expectedRevision: body.expectedRevision, currentRevision: current.revision });
      const data: Prisma.OrganizationToolBindingUncheckedUpdateInput = {};
      if (body.name !== undefined) data.name = body.name;
      if (body.enabled !== undefined) data.enabled = body.enabled;
      if (body.configurationOverrides !== undefined) data.configurationOverrides = body.configurationOverrides as Prisma.InputJsonValue;
      if (body.policyOverrides !== undefined) data.policyOverrides = body.policyOverrides as Prisma.InputJsonValue;
      const count = await this.orgBindings.updateGuarded(orgId, id, body.expectedRevision, data, tx);
      if (count === 0) throw versionConflict({ resourceType: 'organization_tool_binding', resourceId: id, expectedRevision: body.expectedRevision, currentRevision: current.revision });
      await this.audit.record(tx, { organizationId: orgId, actorUserId: ctx.userId, action: 'tool_binding.updated', resourceType: 'organization_tool_binding', resourceId: id, correlationId: ctx.correlationId, metadata: {} });
      const fresh = (await this.orgBindings.findById(orgId, id, tx))!;
      const toolRow = await tx.connectorToolDefinition.findUnique({ where: { id: fresh.connectorToolDefinitionId } });
      return { row: fresh, tool: toolRow! };
    });
    return { data: toOrgToolBindingContract(row, tool.key, tool.version) };
  }

  async disableOrgBinding(ctx: AuthenticatedRequestContext, id: string, expectedRevision: number): Promise<{ data: OrganizationToolBinding }> {
    const orgId = this.orgId(ctx);
    const { row, tool } = await this.prisma.$transaction(async (tx) => {
      const current = await this.orgBindings.findById(orgId, id, tx);
      if (!current) throw toolBindingNotFound();
      assertRevision({ resourceType: 'organization_tool_binding', resourceId: id, expectedRevision, currentRevision: current.revision });
      const count = await this.orgBindings.updateGuarded(orgId, id, expectedRevision, { enabled: false }, tx);
      if (count === 0) throw versionConflict({ resourceType: 'organization_tool_binding', resourceId: id, expectedRevision, currentRevision: current.revision });
      await this.audit.record(tx, { organizationId: orgId, actorUserId: ctx.userId, action: 'tool_binding.disabled', resourceType: 'organization_tool_binding', resourceId: id, correlationId: ctx.correlationId, metadata: {} });
      const fresh = (await this.orgBindings.findById(orgId, id, tx))!;
      const toolRow = await tx.connectorToolDefinition.findUnique({ where: { id: fresh.connectorToolDefinitionId } });
      return { row: fresh, tool: toolRow! };
    });
    return { data: toOrgToolBindingContract(row, tool.key, tool.version) };
  }

  // ── Operation tool binding ────────────────────────────────────────────────────
  private assertActionKeys(keys: string[]): void {
    const invalid = keys.filter((k) => !KNOWN_ACTION_KEYS.has(k));
    if (invalid.length) throw validationError([{ field: 'allowedActionKeys', code: 'unknown', message: `Action keys inválidas: ${invalid.join(', ')}` }]);
  }

  async createOperationBinding(ctx: AuthenticatedRequestContext, operationId: string, body: CreateOperationToolBindingRequest, idempotencyKey: string): Promise<{ statusCode: number; body: { data: OperationToolBinding } }> {
    const orgId = this.orgId(ctx);
    this.assertActionKeys(body.allowedActionKeys);
    const result = await runIdempotentCommand<{ data: OperationToolBinding }>(
      { idem: this.idem, prisma: this.prisma },
      { method: 'POST', path: `/organizations/${orgId}/operations/${operationId}/tool-bindings`, idempotencyKey, userId: ctx.userId, organizationId: orgId },
      body, 201,
      async (tx) => {
        const op = await tx.operation.findFirst({ where: { id: operationId, organizationId: orgId } });
        if (!op) throw notFound('Operação não encontrada.');
        if (body.operationVersionId) {
          const ver = await tx.operationVersion.findFirst({ where: { id: body.operationVersionId, organizationId: orgId, operationId } });
          if (!ver) throw notFound('Versão não pertence à operação.');
        }
        const binding = await this.orgBindings.findById(orgId, body.organizationToolBindingId, tx);
        if (!binding) throw toolBindingNotFound();
        const existing = await this.opBindings.findByAlias(orgId, operationId, body.alias, tx);
        if (existing) throw resourceConflict('Alias já em uso nesta operação.');
        const created = await this.opBindings.create({
          organizationId: orgId, operationId, operationVersionId: body.operationVersionId ?? null,
          organizationToolBindingId: body.organizationToolBindingId, alias: body.alias, enabled: true,
          allowedActionKeys: body.allowedActionKeys as Prisma.InputJsonValue,
          inputMapping: (body.inputMapping ?? {}) as Prisma.InputJsonValue,
          outputMapping: (body.outputMapping ?? {}) as Prisma.InputJsonValue,
          createdByUserId: ctx.userId, revision: 1,
        }, tx);
        await this.audit.record(tx, { organizationId: orgId, actorUserId: ctx.userId, action: 'operation_tool_binding.created', resourceType: 'operation_tool_binding', resourceId: created.id, correlationId: ctx.correlationId, after: { alias: created.alias }, metadata: {} });
        return { data: toOperationToolBindingContract(created) };
      },
    );
    return { statusCode: result.statusCode, body: result.response };
  }

  async updateOperationBinding(ctx: AuthenticatedRequestContext, operationId: string, id: string, body: UpdateOperationToolBindingRequest): Promise<{ data: OperationToolBinding }> {
    const orgId = this.orgId(ctx);
    if (body.allowedActionKeys) this.assertActionKeys(body.allowedActionKeys);
    const fresh = await this.prisma.$transaction(async (tx) => {
      const current = await this.opBindings.findById(orgId, id, tx);
      if (!current || current.operationId !== operationId || current.removedAt) throw toolBindingNotFound();
      assertRevision({ resourceType: 'operation_tool_binding', resourceId: id, expectedRevision: body.expectedRevision, currentRevision: current.revision });
      if (body.alias && body.alias !== current.alias) {
        const clash = await this.opBindings.findByAlias(orgId, operationId, body.alias, tx);
        if (clash) throw resourceConflict('Alias já em uso nesta operação.');
      }
      const data: Prisma.OperationToolBindingUncheckedUpdateInput = {};
      if (body.alias !== undefined) data.alias = body.alias;
      if (body.enabled !== undefined) data.enabled = body.enabled;
      if (body.allowedActionKeys !== undefined) data.allowedActionKeys = body.allowedActionKeys as Prisma.InputJsonValue;
      if (body.inputMapping !== undefined) data.inputMapping = body.inputMapping as Prisma.InputJsonValue;
      if (body.outputMapping !== undefined) data.outputMapping = body.outputMapping as Prisma.InputJsonValue;
      const count = await this.opBindings.updateGuarded(orgId, id, body.expectedRevision, data, tx);
      if (count === 0) throw versionConflict({ resourceType: 'operation_tool_binding', resourceId: id, expectedRevision: body.expectedRevision, currentRevision: current.revision });
      await this.audit.record(tx, { organizationId: orgId, actorUserId: ctx.userId, action: 'operation_tool_binding.updated', resourceType: 'operation_tool_binding', resourceId: id, correlationId: ctx.correlationId, metadata: {} });
      return (await this.opBindings.findById(orgId, id, tx))!;
    });
    return { data: toOperationToolBindingContract(fresh) };
  }

  /** Remoção LÓGICA (preserva histórico). */
  async removeOperationBinding(ctx: AuthenticatedRequestContext, operationId: string, id: string, expectedRevision: number): Promise<{ data: OperationToolBinding }> {
    const orgId = this.orgId(ctx);
    const fresh = await this.prisma.$transaction(async (tx) => {
      const current = await this.opBindings.findById(orgId, id, tx);
      if (!current || current.operationId !== operationId || current.removedAt) throw toolBindingNotFound();
      assertRevision({ resourceType: 'operation_tool_binding', resourceId: id, expectedRevision, currentRevision: current.revision });
      const count = await this.opBindings.softRemove(orgId, id, expectedRevision, ctx.userId, new Date(), tx);
      if (count === 0) throw versionConflict({ resourceType: 'operation_tool_binding', resourceId: id, expectedRevision, currentRevision: current.revision });
      await this.audit.record(tx, { organizationId: orgId, actorUserId: ctx.userId, action: 'operation_tool_binding.removed', resourceType: 'operation_tool_binding', resourceId: id, correlationId: ctx.correlationId, metadata: {} });
      return (await this.opBindings.findById(orgId, id, tx))!;
    });
    return { data: toOperationToolBindingContract(fresh) };
  }

  async listOperationBindings(ctx: AuthenticatedRequestContext, operationId: string): Promise<{ data: OperationToolBinding[] }> {
    const orgId = this.orgId(ctx);
    const rows = await this.opBindings.listByOperation(orgId, operationId);
    return { data: rows.map(toOperationToolBindingContract) };
  }
}
