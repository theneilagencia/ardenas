/**
 * Arden.AS API — serialização DB→contrato de políticas (ARDEN-BE-004).
 * Valida a saída contra o schema do contrato. Default NEUTRO da 1ª versão: efeito
 * DENY, sem condições (seguro; nada substantivo é inventado).
 */

import type {
  Policy as DbPolicy,
  PolicyVersion as DbPolicyVersion,
  OperationPolicyBinding as DbBinding,
} from '@prisma/client';
import {
  policy as policySchema,
  policyVersion as policyVersionSchema,
  operationPolicyBinding as bindingSchema,
  type Policy,
  type PolicyVersion,
  type PolicyDefinition,
  type OperationPolicyBinding,
} from '@arden/contracts';

/** Definição NEUTRA: nega por padrão, sem condições. Documentada. */
export const NEUTRAL_POLICY_DEFINITION: PolicyDefinition = {
  appliesWhen: [],
  effect: 'DENY',
};

export function toPolicyContract(row: DbPolicy): Policy {
  return policySchema.parse({
    id: row.id,
    organizationId: row.organizationId,
    key: row.key,
    name: row.name,
    description: row.description ?? null,
    category: row.category,
    status: row.status,
    currentDraftVersionId: row.currentDraftVersionId ?? null,
    publishedVersionId: row.publishedVersionId ?? null,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    revision: row.revision,
  });
}

export function toPolicyVersionContract(row: DbPolicyVersion): PolicyVersion {
  return policyVersionSchema.parse({
    id: row.id,
    organizationId: row.organizationId,
    policyId: row.policyId,
    versionNumber: row.versionNumber,
    status: row.status,
    definition: row.definition,
    changeSummary: row.changeSummary ?? null,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    publishedBy: row.publishedBy ?? null,
    publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
    revision: row.revision,
  });
}

export function toBindingContract(row: DbBinding): OperationPolicyBinding {
  return bindingSchema.parse({
    id: row.id,
    organizationId: row.organizationId,
    operationId: row.operationId,
    operationVersionId: row.operationVersionId ?? null,
    policyId: row.policyId,
    policyVersionId: row.policyVersionId,
    scope: row.scope,
    priority: row.priority,
    enabled: row.enabled,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    revision: row.revision,
  });
}
