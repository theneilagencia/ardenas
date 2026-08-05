/**
 * Arden.AS API — serializadores de conectores (ARDEN-BE-006.3).
 *
 * Fronteira pública: mapeiam linhas do Prisma para os DTOs do contrato. O
 * serializador de credencial é o LIMITE DE SEGURANÇA — só emite metadados
 * (status/fingerprint/keyVersion/versão/datas), NUNCA campos criptográficos
 * (encryptedSecret/nonce/authTag/encryptedDataKey), mesmo que a linha os possua.
 */

import type {
  ConnectorDefinition as DbConnectorDefinition,
  ConnectorToolDefinition as DbConnectorTool,
  OrganizationConnection as DbConnection,
  ConnectionCredentialVersion as DbCredential,
  OrganizationToolBinding as DbOrgBinding,
  OperationToolBinding as DbOpBinding,
  WebhookEndpoint as DbWebhookEndpoint,
  WebhookDelivery as DbWebhookDelivery,
} from '@prisma/client';
import type {
  ConnectorDefinition,
  ConnectorToolDefinition,
  Connection,
  CredentialMetadata,
  OrganizationToolBinding,
  OperationToolBinding,
  WebhookEndpoint,
  WebhookDelivery,
  ConnectorNetworkPolicy,
  ExternalActionKey,
} from '@arden/contracts';

const iso = (d: Date | null): string | null => (d ? d.toISOString() : null);

export function toConnectorDefinitionContract(row: DbConnectorDefinition): ConnectorDefinition {
  return {
    id: row.id,
    key: row.key as ConnectorDefinition['key'],
    version: row.version,
    name: row.name,
    description: row.description,
    category: row.category,
    status: row.status,
    systemManaged: row.systemManaged,
    productionAllowed: row.productionAllowed,
    configurationSchema: row.configurationSchema as Record<string, unknown>,
    credentialSchema: row.credentialSchema as Record<string, unknown>,
    networkPolicyTemplate: row.networkPolicyTemplate as unknown as ConnectorNetworkPolicy,
    capabilityKeys: row.capabilityKeys as string[],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toConnectorToolContract(row: DbConnectorTool): ConnectorToolDefinition {
  return {
    id: row.id,
    connectorKey: '' as ConnectorToolDefinition['connectorKey'], // preenchido pelo chamador quando necessário
    connectorVersion: '',
    key: row.key,
    version: row.version,
    name: row.name,
    description: row.description,
    actionKey: row.actionKey as ExternalActionKey,
    inputSchema: row.inputSchema as Record<string, unknown>,
    outputSchema: row.outputSchema as Record<string, unknown>,
    riskLevel: row.riskLevel,
    idempotencyMode: row.idempotencyMode,
    retryMode: row.retryMode,
    defaultTimeoutMs: row.defaultTimeoutMs,
    maximumTimeoutMs: row.maximumTimeoutMs,
    active: row.active,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toConnectionContract(row: DbConnection): Connection {
  return {
    id: row.id,
    organizationId: row.organizationId,
    connectorDefinitionId: row.connectorDefinitionId,
    connectorKey: '' as Connection['connectorKey'], // resolvido pelo serviço (join com o catálogo)
    connectorVersion: '',
    name: row.name,
    description: row.description,
    status: row.status,
    configuration: row.configuration as Record<string, unknown>,
    networkPolicy: row.networkPolicy as unknown as ConnectorNetworkPolicy,
    currentCredentialVersionId: row.currentCredentialVersionId,
    lastTestedAt: iso(row.lastTestedAt),
    lastTestStatus: row.lastTestStatus,
    lastErrorCode: row.lastErrorCode,
    lastErrorSummary: row.lastErrorSummary,
    createdByUserId: row.createdByUserId,
    revision: row.revision,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** LIMITE DE SEGURANÇA: nenhum campo criptográfico sai daqui. */
export function toCredentialMetadataContract(row: DbCredential): CredentialMetadata {
  return {
    id: row.id,
    organizationId: row.organizationId,
    connectionId: row.connectionId,
    versionNumber: row.versionNumber,
    status: row.status,
    fingerprint: row.fingerprint ?? '',
    keyVersion: row.keyVersion ?? '',
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt.toISOString(),
    activatedAt: iso(row.activatedAt),
    supersededAt: iso(row.supersededAt),
    revokedAt: iso(row.revokedAt),
  };
}

export function toOrgToolBindingContract(row: DbOrgBinding, connectorToolKey: string, connectorToolVersion: string): OrganizationToolBinding {
  return {
    id: row.id,
    organizationId: row.organizationId,
    connectionId: row.connectionId,
    connectorToolDefinitionId: row.connectorToolDefinitionId,
    connectorToolKey,
    connectorToolVersion,
    name: row.name,
    enabled: row.enabled,
    configurationOverrides: row.configurationOverrides as Record<string, unknown>,
    policyOverrides: row.policyOverrides as Record<string, unknown>,
    createdByUserId: row.createdByUserId,
    revision: row.revision,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toOperationToolBindingContract(row: DbOpBinding): OperationToolBinding {
  return {
    id: row.id,
    organizationId: row.organizationId,
    operationId: row.operationId,
    operationVersionId: row.operationVersionId,
    organizationToolBindingId: row.organizationToolBindingId,
    alias: row.alias,
    enabled: row.enabled,
    allowedActionKeys: row.allowedActionKeys as ExternalActionKey[],
    inputMapping: row.inputMapping as Record<string, unknown>,
    outputMapping: row.outputMapping as Record<string, unknown>,
    createdByUserId: row.createdByUserId,
    revision: row.revision,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toWebhookEndpointContract(row: DbWebhookEndpoint): WebhookEndpoint {
  return {
    id: row.id,
    organizationId: row.organizationId,
    connectionId: row.connectionId,
    key: row.key,
    status: row.status,
    signatureScheme: row.signatureScheme,
    signatureRequired: row.signatureScheme !== 'NONE',
    replayWindowSeconds: row.replayWindowSeconds,
    allowedEventTypes: row.allowedEventTypes as string[],
    operationId: row.operationId,
    operationVersionId: row.operationVersionId,
    createdByUserId: row.createdByUserId,
    revision: row.revision,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toWebhookDeliveryContract(row: DbWebhookDelivery): WebhookDelivery {
  return {
    id: row.id,
    organizationId: row.organizationId,
    webhookEndpointId: row.webhookEndpointId,
    externalDeliveryId: row.externalDeliveryId,
    payloadHash: row.payloadHash,
    status: row.status,
    receivedAt: row.receivedAt.toISOString(),
    processedAt: iso(row.processedAt),
    correlationId: row.correlationId,
    errorCode: row.errorCode,
    errorSummary: row.errorSummary,
  };
}
