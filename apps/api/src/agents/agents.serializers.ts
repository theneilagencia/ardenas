/**
 * Arden.AS API — mappers Prisma → contrato do runtime de agentes (ARDEN-BE-007.2).
 *
 * Fronteira de segurança: nenhuma resposta carrega segredo, credencial, SDK, payload
 * bruto de auditoria, `contentHash` interno ou relação Prisma não contratada. Datas
 * viram ISO. `ModelConfiguration` resolve `providerKey`/`providerVersion` a partir do
 * provider (join no service) — NUNCA expõe `providerDefinitionId` interno.
 */

import type {
  AgentDefinition as DbAgentDefinition,
  AgentVersion as DbAgentVersion,
  ModelConfiguration as DbModelConfiguration,
  ModelProviderDefinition as DbModelProviderDefinition,
  ModelCatalogEntry as DbModelCatalogEntry,
} from '@prisma/client';
import type {
  AgentDefinition,
  AgentVersion,
  ModelConfiguration,
  ModelProviderDefinition,
  ModelProviderCapability,
  ModelCatalogEntry,
} from '@arden/contracts';

const iso = (d: Date | null): string | null => (d ? d.toISOString() : null);

export function toAgentDefinitionContract(row: DbAgentDefinition): AgentDefinition {
  return {
    id: row.id,
    organizationId: row.organizationId,
    key: row.key,
    name: row.name,
    description: row.description,
    status: row.status,
    currentPublishedVersionId: row.currentPublishedVersionId,
    createdByUserId: row.createdByUserId,
    revision: row.revision,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toAgentVersionContract(row: DbAgentVersion): AgentVersion {
  return {
    id: row.id,
    organizationId: row.organizationId,
    agentDefinitionId: row.agentDefinitionId,
    versionNumber: row.versionNumber,
    status: row.status,
    objective: row.objective,
    systemInstructions: row.systemInstructions,
    modelConfigurationId: row.modelConfigurationId,
    inputSchema: row.inputSchema as Record<string, unknown>,
    outputSchema: row.outputSchema as Record<string, unknown>,
    contextPolicy: row.contextPolicy as AgentVersion['contextPolicy'],
    executionPolicy: row.executionPolicy as AgentVersion['executionPolicy'],
    toolPolicy: row.toolPolicy as AgentVersion['toolPolicy'],
    evaluationPolicy: row.evaluationPolicy as AgentVersion['evaluationPolicy'],
    costPolicy: row.costPolicy as AgentVersion['costPolicy'],
    createdByUserId: row.createdByUserId,
    revision: row.revision,
    createdAt: row.createdAt.toISOString(),
    publishedAt: iso(row.publishedAt),
    retiredAt: iso(row.retiredAt),
  };
}

/** Requer o provider (key/version) resolvido pelo service — nunca expõe o id interno. */
export function toModelConfigurationContract(
  row: DbModelConfiguration,
  provider: { key: string; version: string },
): ModelConfiguration {
  return {
    id: row.id,
    organizationId: row.organizationId,
    providerKey: provider.key,
    providerVersion: provider.version,
    name: row.name,
    description: row.description,
    modelId: row.modelId,
    credentialConnectionId: row.credentialConnectionId,
    parameters: row.parameters as ModelConfiguration['parameters'],
    status: row.status,
    createdByUserId: row.createdByUserId,
    revision: row.revision,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toModelProviderContract(row: DbModelProviderDefinition): ModelProviderDefinition {
  return {
    key: row.key,
    version: row.version,
    name: row.name,
    description: row.description,
    status: row.status,
    capabilities: row.capabilities as ModelProviderCapability[],
    productionAllowed: row.productionAllowed,
    systemManaged: row.systemManaged,
  };
}

/** Catálogo de modelos persistido → contrato (sem segredo, sem preço). */
export function toModelCatalogEntryContract(row: DbModelCatalogEntry): ModelCatalogEntry {
  return {
    providerKey: row.providerKey,
    providerVersion: row.providerVersion,
    modelId: row.modelId,
    displayName: row.displayName,
    status: row.status,
    productionAllowed: row.productionAllowed,
    capabilities: row.capabilities as ModelProviderCapability[],
    maximumInputTokens: row.maximumInputTokens,
    maximumOutputTokens: row.maximumOutputTokens,
    supportsStructuredOutput: row.supportsStructuredOutput,
    supportsToolCalling: row.supportsToolCalling,
    supportsPromptCaching: row.supportsPromptCaching,
    supportsVision: row.supportsVision,
    supportsStreaming: row.supportsStreaming,
    rateCardKey: row.rateCardKey,
    sourceReferences: row.sourceReferences as string[],
  };
}
