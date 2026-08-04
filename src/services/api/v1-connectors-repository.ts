/**
 * Arden.AS — repositório de conectores/conexões/credenciais/vínculos/webhooks
 * sobre a API v1 (ARDEN-BE-006.8).
 *
 * Implementa `ConnectorsRepository` (contrato do frontend) contra o backend v1
 * real (ARDEN-BE-006). Repositório API-ONLY: sem fallback para mock/IndexedDB —
 * sem organização ativa lança erro tipado. Segredos (credencial, token de
 * webhook) só trafegam nos requests de escrita; nunca são lidos de volta aqui —
 * o adaptador apenas repassa o que a API retorna, e a API nunca ecoa segredo.
 */

import type {
  Connection,
  ConnectorDefinition,
  ConnectorToolDefinition,
  CreateConnectionCredentialRequest,
  CreateConnectionRequest,
  CreateOperationToolBindingRequest,
  CreateOrganizationToolBindingRequest,
  CreateWebhookEndpointRequest,
  CredentialMetadata,
  ConnectionCommandRequest,
  OperationToolBinding,
  OrganizationToolBinding,
  RotateConnectionCredentialRequest,
  TestConnectionRequest,
  TestConnectionResult,
  UpdateConnectionRequest,
  UpdateOperationToolBindingRequest,
  UpdateOrganizationToolBindingRequest,
  UpdateWebhookEndpointRequest,
  WebhookCommandRequest,
  WebhookEndpoint,
  WebhookEndpointSecret,
} from '@/contracts';
import type {
  ConnectorsRepository,
  CursorPage,
  ListConnectionsInput,
  ListToolBindingsInput,
  ListWebhookEndpointsInput,
} from '@/services/contracts';
import { ArdenRepositoryError, toRepositoryError } from '@/services/errors';
import { getActiveOrganizationId } from '@/services/session/active-context';
import type { ArdenApiV1Client, ClientPage } from './generated/api-v1-client';

function requireOrg(): string {
  const orgId = getActiveOrganizationId();
  if (!orgId) {
    throw new ArdenRepositoryError('UNAVAILABLE', 'Sem organização ativa na sessão (modo api).');
  }
  return orgId;
}

function idem(): string {
  // Chave de idempotência opaca (>=8 chars), fresca a cada ação do usuário.
  return `conn-${crypto.randomUUID()}`;
}

function toCursorPage<T>(page: ClientPage<T>): CursorPage<T> {
  return {
    items: page.data,
    cursor: page.pagination.nextCursor,
    hasNextPage: page.pagination.hasNextPage,
  };
}

/** Repositório real (v1) de conectores. API-only — sem contraparte mock/IndexedDB. */
export function createApiV1ConnectorsRepository(client: ArdenApiV1Client): ConnectorsRepository {
  return {
    // ── Catálogo (público) ───────────────────────────────────────────────────
    async listConnectors(signal): Promise<ConnectorDefinition[]> {
      try {
        return await client.listConnectors({ signal });
      } catch (err) {
        throw toRepositoryError(err);
      }
    },

    async getConnector(connectorKey, signal): Promise<ConnectorDefinition> {
      try {
        return await client.getConnector(connectorKey, { signal });
      } catch (err) {
        throw toRepositoryError(err);
      }
    },

    async listConnectorTools(connectorKey, signal): Promise<ConnectorToolDefinition[]> {
      try {
        return await client.listConnectorTools(connectorKey, { signal });
      } catch (err) {
        throw toRepositoryError(err);
      }
    },

    // ── Conexões ─────────────────────────────────────────────────────────────
    async listConnections(input: ListConnectionsInput = {}): Promise<CursorPage<Connection>> {
      const orgId = requireOrg();
      try {
        const page = await client.listConnections(
          orgId,
          {
            connectorKey: input.connectorKey,
            status: input.status,
            search: input.search,
            cursor: input.cursor,
            limit: input.limit ?? 50,
          },
          { signal: input.signal },
        );
        return toCursorPage(page);
      } catch (err) {
        throw toRepositoryError(err);
      }
    },

    async createConnection(body: CreateConnectionRequest): Promise<Connection> {
      const orgId = requireOrg();
      try {
        return await client.createConnection(orgId, body, { idempotencyKey: idem() });
      } catch (err) {
        throw toRepositoryError(err);
      }
    },

    async getConnection(connectionId, signal): Promise<Connection> {
      const orgId = requireOrg();
      try {
        return await client.getConnection(orgId, connectionId, { signal });
      } catch (err) {
        throw toRepositoryError(err);
      }
    },

    async updateConnection(connectionId, body: UpdateConnectionRequest): Promise<Connection> {
      const orgId = requireOrg();
      try {
        return await client.updateConnection(orgId, connectionId, body);
      } catch (err) {
        throw toRepositoryError(err);
      }
    },

    async testConnection(connectionId, body: TestConnectionRequest = {}): Promise<TestConnectionResult> {
      const orgId = requireOrg();
      try {
        return await client.testConnection(orgId, connectionId, body, { idempotencyKey: idem() });
      } catch (err) {
        throw toRepositoryError(err);
      }
    },

    async activateConnection(connectionId, body: ConnectionCommandRequest): Promise<Connection> {
      const orgId = requireOrg();
      try {
        return await client.activateConnection(orgId, connectionId, body, { idempotencyKey: idem() });
      } catch (err) {
        throw toRepositoryError(err);
      }
    },

    async suspendConnection(connectionId, body: ConnectionCommandRequest): Promise<Connection> {
      const orgId = requireOrg();
      try {
        return await client.suspendConnection(orgId, connectionId, body, { idempotencyKey: idem() });
      } catch (err) {
        throw toRepositoryError(err);
      }
    },

    async reactivateConnection(connectionId, body: ConnectionCommandRequest): Promise<Connection> {
      const orgId = requireOrg();
      try {
        return await client.reactivateConnection(orgId, connectionId, body, { idempotencyKey: idem() });
      } catch (err) {
        throw toRepositoryError(err);
      }
    },

    async revokeConnection(connectionId, body: ConnectionCommandRequest): Promise<Connection> {
      const orgId = requireOrg();
      try {
        return await client.revokeConnection(orgId, connectionId, body, { idempotencyKey: idem() });
      } catch (err) {
        throw toRepositoryError(err);
      }
    },

    // ── Credenciais ──────────────────────────────────────────────────────────
    async listCredentials(connectionId, signal): Promise<CredentialMetadata[]> {
      const orgId = requireOrg();
      try {
        const page = await client.listCredentials(orgId, connectionId, { signal });
        return page.data;
      } catch (err) {
        throw toRepositoryError(err);
      }
    },

    async createCredential(
      connectionId,
      body: CreateConnectionCredentialRequest,
    ): Promise<CredentialMetadata> {
      const orgId = requireOrg();
      try {
        return await client.createCredential(orgId, connectionId, body, { idempotencyKey: idem() });
      } catch (err) {
        throw toRepositoryError(err);
      }
    },

    async rotateCredential(
      connectionId,
      body: RotateConnectionCredentialRequest,
    ): Promise<CredentialMetadata> {
      const orgId = requireOrg();
      try {
        return await client.rotateCredential(orgId, connectionId, body, { idempotencyKey: idem() });
      } catch (err) {
        throw toRepositoryError(err);
      }
    },

    async validateConnectionConfiguration(connectionId, body = {}): Promise<import('@arden/contracts').ConnectionConfigurationValidationResult> {
      const orgId = requireOrg();
      try {
        return await client.validateConnectionConfiguration(orgId, connectionId, body, { idempotencyKey: idem() });
      } catch (err) { throw toRepositoryError(err); }
    },
    async revokeCredential(connectionId, credentialVersionId): Promise<CredentialMetadata> {
      const orgId = requireOrg();
      try {
        return await client.revokeCredential(orgId, connectionId, credentialVersionId, {
          idempotencyKey: idem(),
        });
      } catch (err) {
        throw toRepositoryError(err);
      }
    },

    // ── Vínculos de ferramenta (organização) ────────────────────────────────
    async listToolBindings(
      input: ListToolBindingsInput = {},
    ): Promise<CursorPage<OrganizationToolBinding>> {
      const orgId = requireOrg();
      try {
        const page = await client.listToolBindings(
          orgId,
          {
            connectionId: input.connectionId,
            enabled: input.enabled,
            connectorKey: input.connectorKey,
            toolKey: input.toolKey,
            cursor: input.cursor,
            limit: input.limit ?? 50,
          },
          { signal: input.signal },
        );
        return toCursorPage(page);
      } catch (err) {
        throw toRepositoryError(err);
      }
    },

    async createToolBinding(
      body: CreateOrganizationToolBindingRequest,
    ): Promise<OrganizationToolBinding> {
      const orgId = requireOrg();
      try {
        return await client.createToolBinding(orgId, body, { idempotencyKey: idem() });
      } catch (err) {
        throw toRepositoryError(err);
      }
    },

    async getToolBinding(bindingId, signal): Promise<OrganizationToolBinding> {
      const orgId = requireOrg();
      try {
        return await client.getToolBinding(orgId, bindingId, { signal });
      } catch (err) {
        throw toRepositoryError(err);
      }
    },

    async updateToolBinding(
      bindingId,
      body: UpdateOrganizationToolBindingRequest,
    ): Promise<OrganizationToolBinding> {
      const orgId = requireOrg();
      try {
        return await client.updateToolBinding(orgId, bindingId, body);
      } catch (err) {
        throw toRepositoryError(err);
      }
    },

    async disableToolBinding(bindingId, body: ConnectionCommandRequest): Promise<OrganizationToolBinding> {
      const orgId = requireOrg();
      try {
        return await client.disableToolBinding(orgId, bindingId, body, { idempotencyKey: idem() });
      } catch (err) {
        throw toRepositoryError(err);
      }
    },

    // ── Vínculos de ferramenta (operação) ───────────────────────────────────
    async listOperationToolBindings(operationId, signal): Promise<OperationToolBinding[]> {
      const orgId = requireOrg();
      try {
        return await client.listOperationToolBindings(orgId, operationId, { signal });
      } catch (err) {
        throw toRepositoryError(err);
      }
    },

    async createOperationToolBinding(
      operationId,
      body: CreateOperationToolBindingRequest,
    ): Promise<OperationToolBinding> {
      const orgId = requireOrg();
      try {
        return await client.createOperationToolBinding(orgId, operationId, body, {
          idempotencyKey: idem(),
        });
      } catch (err) {
        throw toRepositoryError(err);
      }
    },

    async updateOperationToolBinding(
      operationId,
      bindingId,
      body: UpdateOperationToolBindingRequest,
    ): Promise<OperationToolBinding> {
      const orgId = requireOrg();
      try {
        return await client.updateOperationToolBinding(orgId, operationId, bindingId, body);
      } catch (err) {
        throw toRepositoryError(err);
      }
    },

    async removeOperationToolBinding(operationId, bindingId): Promise<OperationToolBinding> {
      const orgId = requireOrg();
      try {
        return await client.removeOperationToolBinding(orgId, operationId, bindingId);
      } catch (err) {
        throw toRepositoryError(err);
      }
    },

    // ── Webhooks ─────────────────────────────────────────────────────────────
    async listWebhookEndpoints(
      input: ListWebhookEndpointsInput = {},
    ): Promise<CursorPage<WebhookEndpoint>> {
      const orgId = requireOrg();
      try {
        const page = await client.listWebhookEndpoints(
          orgId,
          {
            status: input.status,
            connectionId: input.connectionId,
            operationId: input.operationId,
            cursor: input.cursor,
            limit: input.limit ?? 50,
          },
          { signal: input.signal },
        );
        return toCursorPage(page);
      } catch (err) {
        throw toRepositoryError(err);
      }
    },

    async createWebhookEndpoint(body: CreateWebhookEndpointRequest): Promise<WebhookEndpointSecret> {
      const orgId = requireOrg();
      try {
        return await client.createWebhookEndpoint(orgId, body, { idempotencyKey: idem() });
      } catch (err) {
        throw toRepositoryError(err);
      }
    },

    async getWebhookEndpoint(webhookEndpointId, signal): Promise<WebhookEndpoint> {
      const orgId = requireOrg();
      try {
        return await client.getWebhookEndpoint(orgId, webhookEndpointId, { signal });
      } catch (err) {
        throw toRepositoryError(err);
      }
    },

    async updateWebhookEndpoint(
      webhookEndpointId,
      body: UpdateWebhookEndpointRequest,
    ): Promise<WebhookEndpoint> {
      const orgId = requireOrg();
      try {
        return await client.updateWebhookEndpoint(orgId, webhookEndpointId, body);
      } catch (err) {
        throw toRepositoryError(err);
      }
    },

    async suspendWebhookEndpoint(
      webhookEndpointId,
      body: WebhookCommandRequest,
    ): Promise<WebhookEndpoint> {
      const orgId = requireOrg();
      try {
        return await client.suspendWebhookEndpoint(orgId, webhookEndpointId, body, {
          idempotencyKey: idem(),
        });
      } catch (err) {
        throw toRepositoryError(err);
      }
    },

    async reactivateWebhookEndpoint(
      webhookEndpointId,
      body: WebhookCommandRequest,
    ): Promise<WebhookEndpoint> {
      const orgId = requireOrg();
      try {
        return await client.reactivateWebhookEndpoint(orgId, webhookEndpointId, body, {
          idempotencyKey: idem(),
        });
      } catch (err) {
        throw toRepositoryError(err);
      }
    },

    async revokeWebhookEndpoint(
      webhookEndpointId,
      body: WebhookCommandRequest,
    ): Promise<WebhookEndpoint> {
      const orgId = requireOrg();
      try {
        return await client.revokeWebhookEndpoint(orgId, webhookEndpointId, body, {
          idempotencyKey: idem(),
        });
      } catch (err) {
        throw toRepositoryError(err);
      }
    },
  };
}
