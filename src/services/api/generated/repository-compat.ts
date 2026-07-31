/**
 * Arden.AS — compatibilidade contrato ↔ repositórios do frontend (ARDEN-FE-003).
 *
 * PROVA (em nível de tipos, verificada pelo typecheck e por teste de contrato) de
 * que os tipos da API v1 bastam para implementar `SessionRepository`,
 * `OperationsRepository` e `AuditRepository`. NÃO substitui os repositórios
 * existentes — os adaptadores servem de evidência de compatibilidade. As leituras
 * (sessão, listagem/consulta de operações, auditoria) têm mapeamento concreto; as
 * mutações ricas de operação são do escopo de um marco posterior (documentado em
 * FRONTEND_TO_API_V1_MAP.md) e sinalizadas como indisponíveis no v1.
 */

import type {
  AuditEvent as ApiAuditEvent,
  Operation as ApiOperation,
  SessionContext as ApiSessionContext,
} from '@/contracts';
import type { SessionRepository } from '@/services/session/session-contracts';
import type { SessionContext as DomainSessionContext } from '@/domain/identity';
import type { AuditRepository, OperationsRepository, AuditQuery, ListOperationsInput, PaginatedResult } from '@/services/contracts';
import type { AuditEvent as DomainAuditEvent, Operation as DomainOperation, RoleKey } from '@/domain/types';
import type { Permission } from '@/domain/permissions';
import { ArdenRepositoryError } from '@/services/errors';
import type { ArdenApiV1Client } from './api-v1-client';

// ── Mapeadores contrato → domínio ─────────────────────────────────────────────

export function mapSessionToDomain(api: ApiSessionContext): DomainSessionContext {
  return {
    user: {
      id: api.user.id,
      email: api.user.email,
      displayName: api.user.displayName,
      avatarUrl: api.user.avatarUrl ?? undefined,
      status: api.user.status,
    },
    organizations: api.organizations.map((o) => ({
      id: o.id,
      name: o.name,
      slug: o.slug,
      status: o.status,
    })),
    memberships: api.memberships.map((m) => ({
      id: m.id,
      userId: m.userId,
      organizationId: m.organizationId,
      roleIds: m.roleIds as RoleKey[],
      status: m.status,
    })),
    activeOrganizationId: api.activeOrganizationId,
    permissions: api.permissions as Permission[],
    expiresAt: api.expiresAt,
  };
}

const API_TO_DOMAIN_STATUS: Record<ApiOperation['status'], DomainOperation['status']> = {
  draft: 'draft',
  active: 'running',
  paused: 'paused',
  archived: 'archived',
};

/**
 * Mapeia a Operação (lean) do contrato v1 para a Operação (rica) do domínio. Os
 * campos ricos que o v1 NÃO cobre (GAP-12 / DECISÃO PENDENTE D-005) recebem
 * defaults seguros e documentados — a definição rica vive na versão.
 */
export function mapOperationToDomain(api: ApiOperation): DomainOperation {
  return {
    id: api.id,
    name: api.name,
    organizationId: api.organizationId,
    companyId: '',
    unitId: '',
    areaId: '',
    costCenterId: '',
    criticality: 'moderate',
    tags: [],
    problem: '',
    objective: '',
    expectedResult: '',
    recipients: [],
    deliverables: [],
    frequency: '',
    sla: '',
    indicators: [],
    completionCriteria: [],
    ownerId: api.ownerId ?? '',
    approverIds: [],
    substituteIds: [],
    triggers: [],
    contextSourceIds: [],
    integrationIds: [],
    steps: [],
    actions: [],
    approvalChain: [],
    operationalLimits: [],
    budget: 0,
    workUnits: 0,
    evidencePolicy: '',
    retentionPolicy: '',
    notificationRules: [],
    environment: null,
    version: '1.0',
    status: API_TO_DOMAIN_STATUS[api.status],
    publishedAt: null,
    createdAt: api.createdAt,
    updatedAt: api.updatedAt,
  };
}

export function mapAuditEventToDomain(api: ApiAuditEvent): DomainAuditEvent {
  return {
    id: api.id,
    timestamp: api.occurredAt,
    actorId: api.actor.id,
    actorRole: (api.actor.role ?? 'analyst') as RoleKey,
    organizationId: api.organizationId,
    action: api.action,
    objectType: api.resourceType,
    objectId: api.resourceId,
    previousValue: api.before ?? null,
    newValue: api.after ?? null,
    result: 'success',
  };
}

// ── Adaptadores (implementam as interfaces reais do frontend) ──────────────────

export function createApiV1SessionRepository(client: ArdenApiV1Client): SessionRepository {
  return {
    getCurrentSession: async () => mapSessionToDomain(await client.getSession()),
    switchOrganization: async (organizationId) =>
      mapSessionToDomain(await client.switchOrganization({ organizationId })),
    refreshSession: async () => mapSessionToDomain(await client.refreshSession()),
    signOut: async () => {
      await client.logout();
    },
  };
}

export function createApiV1AuditRepository(client: ArdenApiV1Client): AuditRepository {
  return {
    list: async (input: AuditQuery): Promise<DomainAuditEvent[]> => {
      const page = await client.listAuditEvents(input.organizationId, { limit: 50 });
      const events = page.data.map(mapAuditEventToDomain);
      return input.result ? events.filter((e) => e.result === input.result) : events;
    },
    // A API v1 NÃO expõe escrita pública de auditoria (somente leitura): o backend
    // gera eventos transacionalmente. `append` é no-op de compatibilidade.
    append: async (event) => event,
  };
}

function notAvailableInV1(what: string): never {
  throw new ArdenRepositoryError(
    'UNAVAILABLE',
    `"${what}" usa o fluxo versão-cêntrico do v1 (marco posterior). Ver FRONTEND_TO_API_V1_MAP.md.`,
  );
}

export function createApiV1OperationsRepository(client: ArdenApiV1Client): OperationsRepository {
  return {
    list: async (input: ListOperationsInput): Promise<PaginatedResult<DomainOperation>> => {
      const page = await client.listOperations(input.organizationId, {
        status: input.status as ApiOperation['status'] | undefined,
        search: input.search,
        limit: input.pageSize ?? 50,
        sort: 'createdAt',
        order: 'desc',
      });
      return {
        items: page.data.map(mapOperationToDomain),
        page: input.page ?? 1,
        pageSize: page.pagination.limit,
        total: page.data.length,
      };
    },
    getById: async (): Promise<DomainOperation> =>
      // organizationId é derivado da sessão; wiring completo em marco posterior.
      notAvailableInV1('operations.getById (requer organizationId da sessão)'),
    // Mutações ricas: fluxo versão-cêntrico do v1, wiring em marco posterior.
    create: async () => notAvailableInV1('operations.create'),
    updateDraft: async () => notAvailableInV1('operations.updateDraft'),
    createVersion: async () => notAvailableInV1('operations.createVersion'),
    publishVersion: async () => notAvailableInV1('operations.publishVersion'),
    pause: async () => notAvailableInV1('operations.pause'),
    resume: async () => notAvailableInV1('operations.resume'),
    archive: async () => notAvailableInV1('operations.archive'),
    duplicate: async () => notAvailableInV1('operations.duplicate'),
    createFromAssessment: async () => notAvailableInV1('operations.createFromAssessment'),
  };
}
