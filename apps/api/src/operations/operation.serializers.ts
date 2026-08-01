/**
 * Arden.AS API — serialização DB→contrato de operações/versões (ARDEN-BE-003).
 *
 * Converte linhas Prisma nos DTOs do CONTRATO compartilhado (`@arden/contracts`)
 * e valida a saída contra o schema Zod (conformidade garantida). Os DEFAULTS
 * NEUTROS abaixo são usados apenas na primeira versão em rascunho — não fabricam
 * conteúdo de negócio (ver docs/api/OPERATION_MODEL_ADAPTER_MAP.md).
 */

import type {
  Operation as DbOperation,
  OperationVersion as DbOperationVersion,
  AuditEvent as DbAuditEvent,
} from '@prisma/client';
import {
  operation as operationSchema,
  operationVersion as operationVersionSchema,
  auditEvent as auditEventSchema,
  type Operation,
  type OperationVersion,
  type OperationDefinition,
  type AuthorityProfile,
  type AuditEvent,
} from '@arden/contracts';

/** Definição NEUTRA (vazia) da primeira versão. Sem conteúdo substantivo. */
export const NEUTRAL_DEFINITION: OperationDefinition = {
  objective: '',
  expectedResult: '',
  triggers: [],
  steps: [],
  actions: [],
  approverIds: [],
  contextSourceIds: [],
  integrationIds: [],
  completionCriteria: [],
  environment: null,
  evidencePolicy: null,
};

/** Perfil de autoridade NEUTRO: nível "observa" (1), sem ações, sem aprovação. */
export const NEUTRAL_AUTHORITY_PROFILE: AuthorityProfile = {
  level: 1,
  allowedActions: [],
  approvalRequired: false,
  approvalPolicyId: null,
  financialLimit: null,
  destructiveActionsAllowed: false,
  justificationRequired: false,
};

export function toOperationContract(row: DbOperation): Operation {
  return operationSchema.parse({
    id: row.id,
    organizationId: row.organizationId,
    name: row.name,
    description: row.description ?? null,
    status: row.status,
    currentDraftVersionId: row.currentDraftVersionId ?? null,
    publishedVersionId: row.publishedVersionId ?? null,
    ownerId: row.ownerId ?? null,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    revision: row.revision,
  });
}

export function toOperationVersionContract(row: DbOperationVersion): OperationVersion {
  return operationVersionSchema.parse({
    id: row.id,
    operationId: row.operationId,
    organizationId: row.organizationId,
    versionNumber: row.versionNumber,
    status: row.status,
    definition: row.definition,
    authorityProfile: row.authorityProfile,
    changeSummary: row.changeSummary ?? null,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    publishedBy: row.publishedBy ?? null,
    publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
    revision: row.revision,
  });
}

export function toAuditEventContract(row: DbAuditEvent): AuditEvent {
  return auditEventSchema.parse({
    id: row.id,
    organizationId: row.organizationId,
    actor: {
      id: row.actorUserId ?? 'system',
      type: row.actorType,
      role: row.actorRole ?? null,
      displayName: row.actorDisplayName ?? null,
    },
    action: row.action,
    resourceType: row.resourceType,
    resourceId: row.resourceId,
    occurredAt: row.occurredAt.toISOString(),
    correlationId: row.correlationId,
    source: row.actorType,
    before: row.before ?? null,
    after: row.after ?? null,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
  });
}
