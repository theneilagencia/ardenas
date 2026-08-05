/**
 * Arden.AS — casos de uso de credenciais de conexão (ARDEN-BE-006.8).
 * O SEGREDO só existe no `body` do request (write-only); a resposta é sempre
 * metadados. O caso de uso não retém, loga nem transforma o segredo — apenas
 * repassa ao repositório.
 */

import type { CreateConnectionCredentialRequest, CredentialMetadata, RotateConnectionCredentialRequest } from '@/contracts';
import { getServices } from '@/services/service-container';
import { toRepositoryError } from '@/services/errors';
import { assertPermission, type RequestContext } from '../request-context';

export async function listCredentials(
  ctx: RequestContext,
  connectionId: string,
  signal?: AbortSignal,
): Promise<CredentialMetadata[]> {
  assertPermission(ctx, 'connection.view');
  try {
    return await getServices().connectors.listCredentials(connectionId, signal);
  } catch (err) {
    throw toRepositoryError(err);
  }
}

export async function createCredential(
  ctx: RequestContext,
  connectionId: string,
  body: CreateConnectionCredentialRequest,
): Promise<CredentialMetadata> {
  assertPermission(ctx, 'connection.rotate_credentials');
  try {
    return await getServices().connectors.createCredential(connectionId, body);
  } catch (err) {
    throw toRepositoryError(err);
  }
}

export async function rotateCredential(
  ctx: RequestContext,
  connectionId: string,
  body: RotateConnectionCredentialRequest,
): Promise<CredentialMetadata> {
  assertPermission(ctx, 'connection.rotate_credentials');
  try {
    return await getServices().connectors.rotateCredential(connectionId, body);
  } catch (err) {
    throw toRepositoryError(err);
  }
}

export async function revokeCredential(
  ctx: RequestContext,
  connectionId: string,
  credentialVersionId: string,
): Promise<CredentialMetadata> {
  assertPermission(ctx, 'connection.revoke');
  try {
    return await getServices().connectors.revokeCredential(connectionId, credentialVersionId);
  } catch (err) {
    throw toRepositoryError(err);
  }
}
