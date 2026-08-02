/**
 * Arden.AS — casos de uso de endpoints de webhook (ARDEN-BE-006.8).
 * `createWebhookEndpoint` retorna o token/segredo de assinatura UMA única vez
 * (write-once) — o caso de uso apenas repassa a resposta; a UI decide como
 * exibir e descartar o segredo (nunca persiste fora do estado local do formulário).
 */

import type {
  CreateWebhookEndpointRequest,
  UpdateWebhookEndpointRequest,
  WebhookCommandRequest,
  WebhookEndpoint,
  WebhookEndpointSecret,
} from '@/contracts';
import type { CursorPage, ListWebhookEndpointsInput } from '@/services/contracts';
import { getServices } from '@/services/service-container';
import { toRepositoryError } from '@/services/errors';
import { assertPermission, type RequestContext } from '../request-context';

export async function listWebhookEndpoints(
  ctx: RequestContext,
  input: ListWebhookEndpointsInput = {},
): Promise<CursorPage<WebhookEndpoint>> {
  assertPermission(ctx, 'webhook.view');
  try {
    return await getServices().connectors.listWebhookEndpoints(input);
  } catch (err) {
    throw toRepositoryError(err);
  }
}

export async function getWebhookEndpoint(
  ctx: RequestContext,
  webhookEndpointId: string,
  signal?: AbortSignal,
): Promise<WebhookEndpoint> {
  assertPermission(ctx, 'webhook.view');
  try {
    return await getServices().connectors.getWebhookEndpoint(webhookEndpointId, signal);
  } catch (err) {
    throw toRepositoryError(err);
  }
}

export async function createWebhookEndpoint(
  ctx: RequestContext,
  body: CreateWebhookEndpointRequest,
): Promise<WebhookEndpointSecret> {
  assertPermission(ctx, 'webhook.manage');
  try {
    return await getServices().connectors.createWebhookEndpoint(body);
  } catch (err) {
    throw toRepositoryError(err);
  }
}

export async function updateWebhookEndpoint(
  ctx: RequestContext,
  webhookEndpointId: string,
  body: UpdateWebhookEndpointRequest,
): Promise<WebhookEndpoint> {
  assertPermission(ctx, 'webhook.manage');
  try {
    return await getServices().connectors.updateWebhookEndpoint(webhookEndpointId, body);
  } catch (err) {
    throw toRepositoryError(err);
  }
}

export async function suspendWebhookEndpoint(
  ctx: RequestContext,
  webhookEndpointId: string,
  body: WebhookCommandRequest,
): Promise<WebhookEndpoint> {
  assertPermission(ctx, 'webhook.manage');
  try {
    return await getServices().connectors.suspendWebhookEndpoint(webhookEndpointId, body);
  } catch (err) {
    throw toRepositoryError(err);
  }
}

export async function reactivateWebhookEndpoint(
  ctx: RequestContext,
  webhookEndpointId: string,
  body: WebhookCommandRequest,
): Promise<WebhookEndpoint> {
  assertPermission(ctx, 'webhook.manage');
  try {
    return await getServices().connectors.reactivateWebhookEndpoint(webhookEndpointId, body);
  } catch (err) {
    throw toRepositoryError(err);
  }
}

export async function revokeWebhookEndpoint(
  ctx: RequestContext,
  webhookEndpointId: string,
  body: WebhookCommandRequest,
): Promise<WebhookEndpoint> {
  assertPermission(ctx, 'webhook.manage');
  try {
    return await getServices().connectors.revokeWebhookEndpoint(webhookEndpointId, body);
  } catch (err) {
    throw toRepositoryError(err);
  }
}
