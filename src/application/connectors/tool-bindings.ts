/**
 * Arden.AS — casos de uso de vínculos de ferramenta (organização e operação)
 * (ARDEN-BE-006.8).
 */

import type {
  ConnectionCommandRequest,
  CreateOperationToolBindingRequest,
  CreateOrganizationToolBindingRequest,
  OperationToolBinding,
  OrganizationToolBinding,
  UpdateOperationToolBindingRequest,
  UpdateOrganizationToolBindingRequest,
} from '@/contracts';
import type { CursorPage, ListToolBindingsInput } from '@/services/contracts';
import { getServices } from '@/services/service-container';
import { toRepositoryError } from '@/services/errors';
import { assertPermission, type RequestContext } from '../request-context';

// ── Vínculos de organização ─────────────────────────────────────────────────

export async function listToolBindings(
  ctx: RequestContext,
  input: ListToolBindingsInput = {},
): Promise<CursorPage<OrganizationToolBinding>> {
  assertPermission(ctx, 'tool.view');
  try {
    return await getServices().connectors.listToolBindings(input);
  } catch (err) {
    throw toRepositoryError(err);
  }
}

export async function getToolBinding(
  ctx: RequestContext,
  bindingId: string,
  signal?: AbortSignal,
): Promise<OrganizationToolBinding> {
  assertPermission(ctx, 'tool.view');
  try {
    return await getServices().connectors.getToolBinding(bindingId, signal);
  } catch (err) {
    throw toRepositoryError(err);
  }
}

export async function createToolBinding(
  ctx: RequestContext,
  body: CreateOrganizationToolBindingRequest,
): Promise<OrganizationToolBinding> {
  assertPermission(ctx, 'tool.bind');
  try {
    return await getServices().connectors.createToolBinding(body);
  } catch (err) {
    throw toRepositoryError(err);
  }
}

export async function updateToolBinding(
  ctx: RequestContext,
  bindingId: string,
  body: UpdateOrganizationToolBindingRequest,
): Promise<OrganizationToolBinding> {
  assertPermission(ctx, 'tool.bind');
  try {
    return await getServices().connectors.updateToolBinding(bindingId, body);
  } catch (err) {
    throw toRepositoryError(err);
  }
}

export async function disableToolBinding(
  ctx: RequestContext,
  bindingId: string,
  body: ConnectionCommandRequest,
): Promise<OrganizationToolBinding> {
  assertPermission(ctx, 'tool.bind');
  try {
    return await getServices().connectors.disableToolBinding(bindingId, body);
  } catch (err) {
    throw toRepositoryError(err);
  }
}

// ── Vínculos de operação ────────────────────────────────────────────────────

export async function listOperationToolBindings(
  ctx: RequestContext,
  operationId: string,
  signal?: AbortSignal,
): Promise<OperationToolBinding[]> {
  assertPermission(ctx, 'tool.view');
  try {
    return await getServices().connectors.listOperationToolBindings(operationId, signal);
  } catch (err) {
    throw toRepositoryError(err);
  }
}

export async function createOperationToolBinding(
  ctx: RequestContext,
  operationId: string,
  body: CreateOperationToolBindingRequest,
): Promise<OperationToolBinding> {
  assertPermission(ctx, 'tool.bind');
  try {
    return await getServices().connectors.createOperationToolBinding(operationId, body);
  } catch (err) {
    throw toRepositoryError(err);
  }
}

export async function updateOperationToolBinding(
  ctx: RequestContext,
  operationId: string,
  bindingId: string,
  body: UpdateOperationToolBindingRequest,
): Promise<OperationToolBinding> {
  assertPermission(ctx, 'tool.bind');
  try {
    return await getServices().connectors.updateOperationToolBinding(operationId, bindingId, body);
  } catch (err) {
    throw toRepositoryError(err);
  }
}

export async function removeOperationToolBinding(
  ctx: RequestContext,
  operationId: string,
  bindingId: string,
): Promise<OperationToolBinding> {
  assertPermission(ctx, 'tool.bind');
  try {
    return await getServices().connectors.removeOperationToolBinding(operationId, bindingId);
  } catch (err) {
    throw toRepositoryError(err);
  }
}
