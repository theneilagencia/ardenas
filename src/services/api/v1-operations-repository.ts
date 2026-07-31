/**
 * Arden.AS — repositório de operações sobre a API v1 (ARDEN-BE-003).
 *
 * Implementa a interface `OperationsRepository` do frontend (operação RICA) contra
 * o backend v1 (LEAN, versão-cêntrico). O conteúdo substantivo vive na
 * `OperationVersion.definition`; o Gradiente é derivado dos passos/ações explícitos
 * da operação. Campos ricos SEM correspondência no v1 recebem DEFAULT NEUTRO na
 * leitura — nada substantivo é inventado (ver docs/api/OPERATION_MODEL_ADAPTER_MAP.md).
 * NÃO há fallback para mock/IndexedDB; sem organização ativa lança erro tipado.
 */

import type {
  Operation as ApiOperation,
  OperationVersion as ApiOperationVersion,
  OperationDefinition,
  AuthorityProfile,
} from '@/contracts';
import { AUTHORITY_LEVEL_NUMBER } from '@/contracts';
import type { Operation as DomainOperation } from '@/domain/types';
import type {
  OperationsRepository,
  ListOperationsInput,
  PaginatedResult,
  CreateOperationInput,
  UpdateOperationDraftInput,
} from '@/services/contracts';
import { ArdenRepositoryError, toRepositoryError } from '@/services/errors';
import { getActiveOrganizationId } from '@/services/session/active-context';
import type { ArdenApiV1Client } from './generated/api-v1-client';
import { mapOperationToDomain } from './generated/repository-compat';

function requireOrg(): string {
  const orgId = getActiveOrganizationId();
  if (!orgId) {
    throw new ArdenRepositoryError('UNAVAILABLE', 'Sem organização ativa na sessão (modo api).');
  }
  return orgId;
}

function idem(): string {
  // Chave de idempotência opaca (>=8 chars). Disponível no navegador e no Node 18+.
  return `op-${crypto.randomUUID()}`;
}

/** Enriquece a operação lean (v1) com a definição da versão (rica). */
function mergeOperation(api: ApiOperation, version?: ApiOperationVersion | null): DomainOperation {
  const base = mapOperationToDomain(api);
  if (!version) return base;
  const d = version.definition;
  return {
    ...base,
    objective: d.objective,
    expectedResult: d.expectedResult,
    triggers: d.triggers,
    steps: d.steps,
    actions: d.actions,
    approverIds: d.approverIds,
    contextSourceIds: d.contextSourceIds,
    integrationIds: d.integrationIds,
    completionCriteria: d.completionCriteria,
    environment: d.environment,
    evidencePolicy: d.evidencePolicy ?? '',
    version: String(version.versionNumber),
    publishedAt: version.publishedAt ?? base.publishedAt,
  };
}

/** Rico → definição do contrato (apenas campos mapeados; sem inventar). */
function toDefinition(op: Partial<DomainOperation>): OperationDefinition {
  return {
    objective: op.objective ?? '',
    expectedResult: op.expectedResult ?? '',
    triggers: op.triggers ?? [],
    steps: (op.steps ?? []).map((s) => ({
      id: s.id,
      order: s.order,
      name: s.name,
      description: s.description,
      authorityLevel: s.authorityLevel,
      requiresApproval: s.requiresApproval,
      workUnitCost: s.workUnitCost,
      producesEvidence: s.producesEvidence,
    })),
    actions: (op.actions ?? []).map((a) => ({
      id: a.id,
      name: a.name,
      authorityLevel: a.authorityLevel,
      destructive: a.destructive,
    })),
    approverIds: op.approverIds ?? [],
    contextSourceIds: op.contextSourceIds ?? [],
    integrationIds: op.integrationIds ?? [],
    completionCriteria: op.completionCriteria ?? [],
    environment: op.environment ?? null,
    evidencePolicy: op.evidencePolicy ? op.evidencePolicy : null,
  };
}

/** Deriva um Gradiente coerente a partir dos passos/ações EXPLÍCITOS da operação. */
function toAuthority(op: Partial<DomainOperation>): AuthorityProfile {
  const actions = op.actions ?? [];
  const steps = op.steps ?? [];
  const levels = [
    ...steps.map((s) => AUTHORITY_LEVEL_NUMBER[s.authorityLevel]),
    ...actions.map((a) => AUTHORITY_LEVEL_NUMBER[a.authorityLevel]),
  ];
  const level = (levels.length ? Math.max(...levels) : 1) as AuthorityProfile['level'];
  const destructiveActionsAllowed = actions.some((a) => a.destructive);
  return {
    level,
    allowedActions: actions.map((a) => ({ key: a.name || a.id, semanticLevel: a.authorityLevel, destructive: a.destructive })),
    approvalRequired: level >= 4 || steps.some((s) => s.requiresApproval),
    approvalPolicyId: null,
    financialLimit: null,
    destructiveActionsAllowed,
    justificationRequired: level === 5,
  };
}

/** Repositório de operações real (v1). Substitui o mock/IndexedDB no modo api. */
export function createApiV1OperationsRepository(client: ArdenApiV1Client): OperationsRepository {
  const getVersion = (orgId: string, opId: string, versionId: string) =>
    client.getOperationVersion(orgId, opId, versionId);

  return {
    async list(input: ListOperationsInput): Promise<PaginatedResult<DomainOperation>> {
      const page = await client.listOperations(input.organizationId, {
        status: input.status === 'all' ? undefined : (input.status as ApiOperation['status'] | undefined),
        search: input.search,
        limit: input.pageSize ?? 50,
        sort: 'updatedAt',
        order: 'desc',
      });
      return {
        items: page.data.map((o) => mapOperationToDomain(o)),
        page: input.page ?? 1,
        pageSize: page.pagination.limit,
        total: page.data.length,
      };
    },

    async getById(id, signal): Promise<DomainOperation> {
      const orgId = requireOrg();
      try {
        const op = await client.getOperation(orgId, id, { signal });
        const versionId = op.currentDraftVersionId ?? op.publishedVersionId;
        const version = versionId ? await getVersion(orgId, id, versionId) : null;
        return mergeOperation(op, version);
      } catch (err) {
        throw toRepositoryError(err);
      }
    },

    async create(input: CreateOperationInput): Promise<DomainOperation> {
      const orgId = requireOrg();
      try {
        const op = await client.createOperation(
          orgId,
          { name: input.name, description: input.problem || null, ownerId: input.ownerId || undefined },
          { idempotencyKey: idem() },
        );
        const draftId = op.currentDraftVersionId;
        let version: ApiOperationVersion | null = null;
        if (draftId) {
          version = await getVersion(orgId, op.id, draftId);
          version = await client.updateOperationVersion(orgId, op.id, draftId, {
            definition: toDefinition(input),
            expectedRevision: version.revision,
          });
          version = await client.updateAuthorityProfile(orgId, op.id, draftId, {
            authorityProfile: toAuthority(input),
            expectedRevision: version.revision,
          });
        }
        const fresh = await client.getOperation(orgId, op.id);
        return mergeOperation(fresh, version);
      } catch (err) {
        throw toRepositoryError(err);
      }
    },

    async updateDraft(id, input: UpdateOperationDraftInput): Promise<DomainOperation> {
      const orgId = requireOrg();
      try {
        let op = await client.getOperation(orgId, id);
        if (input.name !== undefined || input.problem !== undefined || input.ownerId !== undefined) {
          op = await client.updateOperation(orgId, id, {
            name: input.name,
            description: input.problem ?? undefined,
            ownerId: input.ownerId ?? undefined,
            expectedRevision: op.revision,
          });
        }
        let version: ApiOperationVersion | null = null;
        const draftId = op.currentDraftVersionId;
        if (draftId) {
          version = await getVersion(orgId, id, draftId);
          const merged = { ...mergeOperation(op, version), ...input };
          version = await client.updateOperationVersion(orgId, id, draftId, {
            definition: toDefinition(merged),
            expectedRevision: version.revision,
          });
        }
        return mergeOperation(op, version);
      } catch (err) {
        throw toRepositoryError(err);
      }
    },

    async createVersion(id): Promise<DomainOperation> {
      const orgId = requireOrg();
      try {
        const op = await client.getOperation(orgId, id);
        // Se já há rascunho (ex.: recém-criada), reutiliza — comando de compat.
        if (op.currentDraftVersionId) {
          const v = await getVersion(orgId, id, op.currentDraftVersionId);
          return mergeOperation(op, v);
        }
        const version = await client.createOperationVersion(orgId, id, {}, { idempotencyKey: idem() });
        const fresh = await client.getOperation(orgId, id);
        return mergeOperation(fresh, version);
      } catch (err) {
        throw toRepositoryError(err);
      }
    },

    async publishVersion(id): Promise<DomainOperation> {
      const orgId = requireOrg();
      try {
        const op = await client.getOperation(orgId, id);
        const draftId = op.currentDraftVersionId;
        if (!draftId) throw new ArdenRepositoryError('CONFLICT', 'Nenhum rascunho para publicar.');
        const version = await getVersion(orgId, id, draftId);
        const result = await client.publishOperationVersion(
          orgId,
          id,
          draftId,
          { expectedRevision: version.revision, changeSummary: `Publicação de ${op.name}` },
          { idempotencyKey: idem() },
        );
        return mergeOperation(result.operation, result.version);
      } catch (err) {
        throw toRepositoryError(err);
      }
    },

    async pause(id): Promise<DomainOperation> {
      const orgId = requireOrg();
      try {
        const op = await client.getOperation(orgId, id);
        const paused = await client.pauseOperation(orgId, id, { expectedRevision: op.revision });
        return mergeOperation(paused);
      } catch (err) {
        throw toRepositoryError(err);
      }
    },

    async resume(id): Promise<DomainOperation> {
      const orgId = requireOrg();
      try {
        const op = await client.getOperation(orgId, id);
        const resumed = await client.resumeOperation(orgId, id, { expectedRevision: op.revision });
        return mergeOperation(resumed);
      } catch (err) {
        throw toRepositoryError(err);
      }
    },

    async archive(id): Promise<void> {
      const orgId = requireOrg();
      try {
        const op = await client.getOperation(orgId, id);
        await client.archiveOperation(orgId, id, { expectedRevision: op.revision }, { idempotencyKey: idem() });
      } catch (err) {
        throw toRepositoryError(err);
      }
    },

    async duplicate(id): Promise<DomainOperation> {
      const orgId = requireOrg();
      try {
        const dup = await client.duplicateOperation(orgId, id, {}, { idempotencyKey: idem() });
        const versionId = dup.currentDraftVersionId;
        const version = versionId ? await getVersion(orgId, dup.id, versionId) : null;
        return mergeOperation(dup, version);
      } catch (err) {
        throw toRepositoryError(err);
      }
    },

    async createFromAssessment(): Promise<DomainOperation> {
      // Assessment → operação é fluxo de um marco posterior (fora do ARDEN-BE-003).
      throw new ArdenRepositoryError(
        'UNAVAILABLE',
        'createFromAssessment não faz parte do v1 (marco posterior).',
      );
    },
  };
}
