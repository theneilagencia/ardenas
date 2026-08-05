/**
 * Arden.AS — stub de conectores para os modos mock/IndexedDB (ARDEN-BE-006.8).
 *
 * Integrações (conectores, conexões, credenciais, vínculos, webhooks) são
 * API-ONLY: não há persistência local para este agregado. Leituras (listas)
 * retornam vazio — a UI trata como estado vazio, nunca inventa dado. Escritas
 * lançam `ArdenRepositoryError('UNAVAILABLE')` com mensagem clara; NUNCA falha a
 * inicialização do app nos modos mock/indexeddb.
 */

import type { ConnectorsRepository, CursorPage } from '@/services/contracts';
import { ArdenRepositoryError } from '@/services/errors';

function unavailable(action: string): never {
  throw new ArdenRepositoryError(
    'UNAVAILABLE',
    `Integrações (${action}) só estão disponíveis no modo api (VITE_DATA_PROVIDER=api).`,
  );
}

const emptyPage: CursorPage<never> = { items: [], cursor: null, hasNextPage: false };

/** Repositório de conectores indisponível fora do modo api (sem fallback silencioso). */
export function createUnavailableConnectorsRepository(): ConnectorsRepository {
  return {
    listConnectors: async () => [],
    getConnector: async () => unavailable('connectors.get'),
    listConnectorTools: async () => [],

    listConnections: async () => emptyPage,
    createConnection: async () => unavailable('connections.create'),
    getConnection: async () => unavailable('connections.get'),
    updateConnection: async () => unavailable('connections.update'),
    testConnection: async () => unavailable('connections.test'),
    activateConnection: async () => unavailable('connections.activate'),
    suspendConnection: async () => unavailable('connections.suspend'),
    reactivateConnection: async () => unavailable('connections.reactivate'),
    revokeConnection: async () => unavailable('connections.revoke'),

    listCredentials: async () => [],
    createCredential: async () => unavailable('credentials.create'),
    rotateCredential: async () => unavailable('credentials.rotate'),
    revokeCredential: async () => unavailable('credentials.revoke'),
    validateConnectionConfiguration: async () => unavailable('connections.validateConfiguration'),

    listToolBindings: async () => emptyPage,
    createToolBinding: async () => unavailable('toolBindings.create'),
    getToolBinding: async () => unavailable('toolBindings.get'),
    updateToolBinding: async () => unavailable('toolBindings.update'),
    disableToolBinding: async () => unavailable('toolBindings.disable'),

    listOperationToolBindings: async () => [],
    createOperationToolBinding: async () => unavailable('operationToolBindings.create'),
    updateOperationToolBinding: async () => unavailable('operationToolBindings.update'),
    removeOperationToolBinding: async () => unavailable('operationToolBindings.remove'),

    listWebhookEndpoints: async () => emptyPage,
    createWebhookEndpoint: async () => unavailable('webhooks.create'),
    getWebhookEndpoint: async () => unavailable('webhooks.get'),
    updateWebhookEndpoint: async () => unavailable('webhooks.update'),
    suspendWebhookEndpoint: async () => unavailable('webhooks.suspend'),
    reactivateWebhookEndpoint: async () => unavailable('webhooks.reactivate'),
    revokeWebhookEndpoint: async () => unavailable('webhooks.revoke'),
  };
}
