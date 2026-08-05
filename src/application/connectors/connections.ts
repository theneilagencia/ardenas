/**
 * Arden.AS — casos de uso de conexões (ARDEN-BE-006.8).
 * O tenant vem SEMPRE do `RequestContext` (sessão ativa) — nunca de formulário.
 * Cada mutação exige `expectedRevision` (concorrência otimista) explicitamente
 * fornecido pela UI a partir do recurso lido por último.
 */

import type {
  Connection,
  ConnectionCommandRequest,
  ConnectionConfigurationValidationResult,
  CreateConnectionRequest,
  TestConnectionRequest,
  TestConnectionResult,
  UpdateConnectionRequest,
  ValidateConnectionConfigurationRequest,
} from '@/contracts';
import type { CursorPage, ListConnectionsInput } from '@/services/contracts';
import { getServices } from '@/services/service-container';
import { toRepositoryError } from '@/services/errors';
import { assertPermission, type RequestContext } from '../request-context';

export async function listConnections(
  ctx: RequestContext,
  input: ListConnectionsInput = {},
): Promise<CursorPage<Connection>> {
  assertPermission(ctx, 'connection.view');
  try {
    return await getServices().connectors.listConnections(input);
  } catch (err) {
    throw toRepositoryError(err);
  }
}

export async function getConnection(
  ctx: RequestContext,
  connectionId: string,
  signal?: AbortSignal,
): Promise<Connection> {
  assertPermission(ctx, 'connection.view');
  try {
    return await getServices().connectors.getConnection(connectionId, signal);
  } catch (err) {
    throw toRepositoryError(err);
  }
}

export async function createConnection(
  ctx: RequestContext,
  body: CreateConnectionRequest,
): Promise<Connection> {
  assertPermission(ctx, 'connection.create');
  try {
    return await getServices().connectors.createConnection(body);
  } catch (err) {
    throw toRepositoryError(err);
  }
}

export async function updateConnection(
  ctx: RequestContext,
  connectionId: string,
  body: UpdateConnectionRequest,
): Promise<Connection> {
  assertPermission(ctx, 'connection.edit');
  try {
    return await getServices().connectors.updateConnection(connectionId, body);
  } catch (err) {
    throw toRepositoryError(err);
  }
}

export async function testConnection(
  ctx: RequestContext,
  connectionId: string,
  body: TestConnectionRequest = {},
): Promise<TestConnectionResult> {
  assertPermission(ctx, 'connection.test');
  try {
    return await getServices().connectors.testConnection(connectionId, body);
  } catch (err) {
    throw toRepositoryError(err);
  }
}

/**
 * Validação LOCAL da configuração da conexão (§9). Confirma que a credencial
 * existe/decifra e que o conector é compatível com o provider — NUNCA prova que
 * a credencial é válida perante a Anthropic (o resultado sempre traz
 * `providerVerificationStatus: NOT_VERIFIED_WITH_PROVIDER`). Sem rede externa.
 */
export async function validateConnectionConfiguration(
  ctx: RequestContext,
  connectionId: string,
  body: ValidateConnectionConfigurationRequest = {},
): Promise<ConnectionConfigurationValidationResult> {
  assertPermission(ctx, 'connection.test');
  try {
    return await getServices().connectors.validateConnectionConfiguration(connectionId, body);
  } catch (err) {
    throw toRepositoryError(err);
  }
}

export async function activateConnection(
  ctx: RequestContext,
  connectionId: string,
  body: ConnectionCommandRequest,
): Promise<Connection> {
  assertPermission(ctx, 'connection.edit');
  try {
    return await getServices().connectors.activateConnection(connectionId, body);
  } catch (err) {
    throw toRepositoryError(err);
  }
}

export async function suspendConnection(
  ctx: RequestContext,
  connectionId: string,
  body: ConnectionCommandRequest,
): Promise<Connection> {
  assertPermission(ctx, 'connection.edit');
  try {
    return await getServices().connectors.suspendConnection(connectionId, body);
  } catch (err) {
    throw toRepositoryError(err);
  }
}

export async function reactivateConnection(
  ctx: RequestContext,
  connectionId: string,
  body: ConnectionCommandRequest,
): Promise<Connection> {
  assertPermission(ctx, 'connection.edit');
  try {
    return await getServices().connectors.reactivateConnection(connectionId, body);
  } catch (err) {
    throw toRepositoryError(err);
  }
}

export async function revokeConnection(
  ctx: RequestContext,
  connectionId: string,
  body: ConnectionCommandRequest,
): Promise<Connection> {
  assertPermission(ctx, 'connection.revoke');
  try {
    return await getServices().connectors.revokeConnection(connectionId, body);
  } catch (err) {
    throw toRepositoryError(err);
  }
}
