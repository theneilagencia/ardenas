/**
 * Arden.AS — casos de uso do catálogo de conectores (ARDEN-BE-006.8).
 * Leitura pública (não tenant-scoped no backend); a checagem de permissão local
 * é a mesma defesa de UX dos demais casos de uso.
 */

import type { ConnectorDefinition, ConnectorToolDefinition } from '@/contracts';
import { getServices } from '@/services/service-container';
import { toRepositoryError } from '@/services/errors';
import { assertPermission, type RequestContext } from '../request-context';

export async function listConnectors(
  ctx: RequestContext,
  signal?: AbortSignal,
): Promise<ConnectorDefinition[]> {
  assertPermission(ctx, 'connector.view');
  try {
    return await getServices().connectors.listConnectors(signal);
  } catch (err) {
    throw toRepositoryError(err);
  }
}

export async function getConnector(
  ctx: RequestContext,
  connectorKey: string,
  signal?: AbortSignal,
): Promise<ConnectorDefinition> {
  assertPermission(ctx, 'connector.view');
  try {
    return await getServices().connectors.getConnector(connectorKey, signal);
  } catch (err) {
    throw toRepositoryError(err);
  }
}

export async function listConnectorTools(
  ctx: RequestContext,
  connectorKey: string,
  signal?: AbortSignal,
): Promise<ConnectorToolDefinition[]> {
  assertPermission(ctx, 'connector.view');
  try {
    return await getServices().connectors.listConnectorTools(connectorKey, signal);
  } catch (err) {
    throw toRepositoryError(err);
  }
}
