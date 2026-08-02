/**
 * Arden.AS API — serviço de persistência de conexões (ARDEN-BE-006.3).
 *
 * Sem HTTP. Cria/edita/transiciona conexões de forma TENANT-SCOPED, com máquina de
 * estados, concorrência otimista (revision) e auditoria imutável. Reusa
 * `runIdempotentCommand` e `AuditRecorder`. Valida a `networkPolicy` contra o
 * contrato compartilhado; a validação específica do JSON Schema do conector fica
 * para 006.4 (documentado). NÃO aceita segredo.
 */

import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { connectorNetworkPolicy, type CreateConnectionRequest, type UpdateConnectionRequest, type Connection, type ConnectionStatus } from '@arden/contracts';
import { PrismaService } from '../../database/prisma.service';
import { IdempotencyService } from '../../modules/idempotency/idempotency.service';
import { AuditRecorder } from '../../audit/audit.recorder';
import { runIdempotentCommand } from '../../operations/command.helpers';
import { assertRevision } from '../../common/concurrency/optimistic-concurrency';
import type { AuthenticatedRequestContext } from '../../identity/request-context';
import {
  notFound, connectorNotAvailable, connectorDeprecated, invalidStateTransition, connectionRevoked, versionConflict,
} from '../../common/errors/api-error';
import { OrganizationConnectionsRepository } from './connections.repository';
import { ConnectorDefinitionsRepository } from '../catalog/catalog.repository';
import { canTransitionConnection } from '../connector.state-machines';
import { toConnectionContract } from '../connectors.serializers';

/** Ação de auditoria por estado de destino. */
const TRANSITION_AUDIT: Record<Exclude<ConnectionStatus, 'DRAFT'>, string> = {
  ACTIVE: 'connection.activated',
  SUSPENDED: 'connection.suspended',
  ERROR: 'connection.error_marked',
  REVOKED: 'connection.revoked',
};

@Injectable()
export class ConnectionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repo: OrganizationConnectionsRepository,
    private readonly connectors: ConnectorDefinitionsRepository,
    private readonly idem: IdempotencyService,
    private readonly audit: AuditRecorder,
  ) {}

  private orgId(ctx: AuthenticatedRequestContext): string {
    return ctx.organizationId as string;
  }

  private async withKey(row: Awaited<ReturnType<OrganizationConnectionsRepository['findById']>>): Promise<Connection> {
    const contract = toConnectionContract(row!);
    const def = await this.prisma.connectorDefinition.findUnique({ where: { id: row!.connectorDefinitionId } });
    if (def) {
      contract.connectorKey = def.key as Connection['connectorKey'];
      contract.connectorVersion = def.version;
    }
    return contract;
  }

  async create(ctx: AuthenticatedRequestContext, body: CreateConnectionRequest, idempotencyKey: string): Promise<{ statusCode: number; body: { data: Connection } }> {
    const orgId = this.orgId(ctx);
    if (body.networkPolicy) connectorNetworkPolicy.parse(body.networkPolicy);

    const result = await runIdempotentCommand<{ data: Connection }>(
      { idem: this.idem, prisma: this.prisma },
      { method: 'POST', path: `/organizations/${orgId}/connections`, idempotencyKey, userId: ctx.userId, organizationId: orgId },
      body, 201,
      async (tx) => {
        const def = await this.connectors.findByKeyAndVersion(body.connectorKey, body.connectorVersion, tx);
        if (!def || def.status === 'DISABLED') throw connectorNotAvailable();
        if (def.status === 'DEPRECATED') throw connectorDeprecated();
        const networkPolicy = (body.networkPolicy ?? def.networkPolicyTemplate) as Prisma.InputJsonValue;
        const created = await this.repo.create({
          organizationId: orgId,
          connectorDefinitionId: def.id,
          name: body.name,
          description: body.description ?? null,
          status: 'DRAFT',
          configuration: (body.configuration ?? {}) as Prisma.InputJsonValue,
          networkPolicy,
          createdByUserId: ctx.userId,
          revision: 1,
        }, tx);
        await this.audit.record(tx, {
          organizationId: orgId, actorUserId: ctx.userId, action: 'connection.created',
          resourceType: 'organization_connection', resourceId: created.id, correlationId: ctx.correlationId,
          after: { name: created.name, status: created.status, connectorKey: def.key }, metadata: {},
        });
        return { data: await this.withKey(created) };
      },
    );
    return { statusCode: result.statusCode, body: result.response };
  }

  async update(ctx: AuthenticatedRequestContext, id: string, body: UpdateConnectionRequest): Promise<{ data: Connection }> {
    const orgId = this.orgId(ctx);
    if (body.networkPolicy) connectorNetworkPolicy.parse(body.networkPolicy);
    const fresh = await this.prisma.$transaction(async (tx) => {
      const current = await this.repo.findById(orgId, id, tx);
      if (!current) throw notFound('Conexão não encontrada.');
      assertRevision({ resourceType: 'organization_connection', resourceId: id, expectedRevision: body.expectedRevision, currentRevision: current.revision });
      const data: Prisma.OrganizationConnectionUncheckedUpdateInput = {};
      if (body.name !== undefined) data.name = body.name;
      if (body.description !== undefined) data.description = body.description;
      if (body.configuration !== undefined) data.configuration = body.configuration as Prisma.InputJsonValue;
      if (body.networkPolicy !== undefined) data.networkPolicy = body.networkPolicy as Prisma.InputJsonValue;
      const count = await this.repo.updateGuarded(orgId, id, body.expectedRevision, data, tx);
      if (count === 0) throw versionConflict({ resourceType: 'organization_connection', resourceId: id, expectedRevision: body.expectedRevision, currentRevision: current.revision });
      await this.audit.record(tx, { organizationId: orgId, actorUserId: ctx.userId, action: 'connection.updated', resourceType: 'organization_connection', resourceId: id, correlationId: ctx.correlationId, metadata: {} });
      return (await this.repo.findById(orgId, id, tx))!;
    });
    return { data: await this.withKey(fresh) };
  }

  async transitionStatus(ctx: AuthenticatedRequestContext, id: string, target: ConnectionStatus, expectedRevision: number, reason?: string): Promise<{ data: Connection }> {
    const orgId = this.orgId(ctx);
    const fresh = await this.prisma.$transaction(async (tx) => {
      const current = await this.repo.findById(orgId, id, tx);
      if (!current) throw notFound('Conexão não encontrada.');
      assertRevision({ resourceType: 'organization_connection', resourceId: id, expectedRevision, currentRevision: current.revision });
      if (current.status === 'REVOKED') throw connectionRevoked();
      if (!canTransitionConnection(current.status, target)) throw invalidStateTransition(`Transição inválida ${current.status} → ${target}.`);
      const count = await this.repo.updateGuarded(orgId, id, expectedRevision, { status: target }, tx);
      if (count === 0) throw versionConflict({ resourceType: 'organization_connection', resourceId: id, expectedRevision, currentRevision: current.revision });
      const action = target === 'ACTIVE' && current.status !== 'DRAFT' ? 'connection.reactivated' : TRANSITION_AUDIT[target as Exclude<ConnectionStatus, 'DRAFT'>];
      await this.audit.record(tx, { organizationId: orgId, actorUserId: ctx.userId, action, resourceType: 'organization_connection', resourceId: id, correlationId: ctx.correlationId, before: { status: current.status }, after: { status: target }, metadata: reason ? { reason } : {} });
      return (await this.repo.findById(orgId, id, tx))!;
    });
    return { data: await this.withKey(fresh) };
  }

  async get(ctx: AuthenticatedRequestContext, id: string): Promise<{ data: Connection }> {
    const row = await this.repo.findById(this.orgId(ctx), id);
    if (!row) throw notFound('Conexão não encontrada.');
    return { data: await this.withKey(row) };
  }

  async list(ctx: AuthenticatedRequestContext, filters: { connectorDefinitionId?: string; status?: ConnectionStatus; search?: string }, limit: number, cursor?: string): Promise<{ data: Connection[]; nextCursor: string | null }> {
    const rows = await this.repo.list(this.orgId(ctx), filters, limit + 1, cursor);
    const hasNext = rows.length > limit;
    const page = hasNext ? rows.slice(0, limit) : rows;
    const data = await Promise.all(page.map((r) => this.withKey(r)));
    return { data, nextCursor: hasNext && page.length ? page[page.length - 1].createdAt.toISOString() : null };
  }
}
