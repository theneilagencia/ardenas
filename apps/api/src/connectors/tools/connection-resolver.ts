/**
 * Arden.AS API — resolução de conexão ativa para execução (ARDEN-BE-006.6).
 *
 * TENANT-SCOPED. Valida tenant, status ACTIVE, credencial ativa, conector,
 * productionAllowed, política de rede, configuração e revision. NÃO resolve o segredo
 * (o plaintext é resolvido pelo `CredentialResolver` IMEDIATAMENTE antes da chamada).
 */

import { Injectable } from '@nestjs/common';
import {
  notFound, connectionNotActive, connectionSuspended, connectionRevoked, credentialRequired, toolExecutionDenied,
} from '../../common/errors/api-error';
import { OrganizationConnectionsRepository, ConnectionCredentialVersionsRepository } from '../connections/connections.repository';
import { ConnectorDefinitionsRepository } from '../catalog/catalog.repository';
import { buildSecureHttpPolicy } from './network-policy-runtime';
import type { ResolvedConnection } from './tool-execution.types';

export interface ResolveConnectionInput {
  organizationId: string;
  connectionId: string;
  nodeEnv: string;
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

@Injectable()
export class ConnectionResolver {
  constructor(
    private readonly connections: OrganizationConnectionsRepository,
    private readonly credentials: ConnectionCredentialVersionsRepository,
    private readonly connectors: ConnectorDefinitionsRepository,
  ) {}

  async resolveActiveConnection(input: ResolveConnectionInput): Promise<ResolvedConnection> {
    const { organizationId, connectionId, nodeEnv } = input;
    const conn = await this.connections.findById(organizationId, connectionId);
    if (!conn) throw notFound('Conexão não encontrada.');
    if (conn.status === 'REVOKED') throw connectionRevoked();
    if (conn.status === 'SUSPENDED') throw connectionSuspended();
    if (conn.status !== 'ACTIVE') throw connectionNotActive();
    if (!conn.currentCredentialVersionId) throw credentialRequired();

    const active = await this.credentials.findActive(organizationId, connectionId);
    if (!active || active.id !== conn.currentCredentialVersionId) throw credentialRequired();

    const connector = await this.connectors.findById(conn.connectorDefinitionId);
    if (!connector || connector.status !== 'ACTIVE') throw notFound('Conector indisponível.');
    if (!connector.productionAllowed && nodeEnv === 'production') {
      throw toolExecutionDenied('Conector de teste é proibido em produção.');
    }

    const networkPolicy = buildSecureHttpPolicy(
      { template: connector.networkPolicyTemplate, connectionPolicy: conn.networkPolicy },
      nodeEnv,
    );

    return {
      connectionId: conn.id,
      connectorDefinitionId: connector.id,
      connectorKey: connector.key,
      connectorVersion: connector.version,
      status: conn.status,
      configuration: asObject(conn.configuration),
      networkPolicy,
      currentCredentialVersionId: conn.currentCredentialVersionId,
      productionAllowed: connector.productionAllowed,
      credentialSchema: asObject(connector.credentialSchema),
      revision: conn.revision,
    };
  }
}
