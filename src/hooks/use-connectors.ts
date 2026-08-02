/**
 * Arden.AS — hooks de integrações: catálogo, conexões, credenciais, vínculos de
 * ferramenta e webhooks (ARDEN-BE-006.8).
 *
 * Única porta da UI para conectores: consomem a camada de aplicação (que usa os
 * repositórios) passando o `RequestContext` derivado da SESSÃO ATIVA. O tenant
 * nunca é digitado num formulário — vem sempre da sessão. Segredos (credencial,
 * token de webhook) NUNCA passam pelo cache do React Query: os casos de uso de
 * escrita apenas repassam a resposta da API, que nunca ecoa segredo de volta.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ConnectionCommandRequest,
  CreateConnectionCredentialRequest,
  CreateConnectionRequest,
  CreateOperationToolBindingRequest,
  CreateOrganizationToolBindingRequest,
  CreateWebhookEndpointRequest,
  RotateConnectionCredentialRequest,
  TestConnectionRequest,
  UpdateConnectionRequest,
  UpdateOperationToolBindingRequest,
  UpdateOrganizationToolBindingRequest,
  UpdateWebhookEndpointRequest,
  WebhookCommandRequest,
} from '@/contracts';
import type { ArdenRepositoryError } from '@/services/errors';
import { ArdenRepositoryError as RepoError } from '@/services/errors';
import type { ListConnectionsInput, ListToolBindingsInput, ListWebhookEndpointsInput } from '@/services/contracts';
import {
  activateConnection,
  createConnection,
  createCredential,
  createOperationToolBinding,
  createToolBinding,
  createWebhookEndpoint,
  disableToolBinding,
  getConnection,
  getConnector,
  listConnections,
  listConnectors,
  listConnectorTools,
  listCredentials,
  listOperationToolBindings,
  listToolBindings,
  listWebhookEndpoints,
  reactivateConnection,
  reactivateWebhookEndpoint,
  removeOperationToolBinding,
  revokeConnection,
  revokeCredential,
  revokeWebhookEndpoint,
  rotateCredential,
  suspendConnection,
  suspendWebhookEndpoint,
  testConnection,
  updateConnection,
  updateOperationToolBinding,
  updateToolBinding,
  updateWebhookEndpoint,
  type RequestContext,
} from '@/application';
import { useTenant } from '@/app/tenant-context';
import { useRequestContext } from './use-session';

const CATALOG_KEY = 'connector-catalog';
const CONNECTIONS_KEY = 'connections';
const CONNECTION_KEY = 'connection';
const CREDENTIALS_KEY = 'credentials';
const TOOL_BINDINGS_KEY = 'tool-bindings';
const OPERATION_TOOL_BINDINGS_KEY = 'operation-tool-bindings';
const WEBHOOKS_KEY = 'webhook-endpoints';

/** Erro tipado para quando não há tenant ativo (a UI trata como estado vazio). */
function noTenant(): RepoError {
  return new RepoError('UNAVAILABLE', 'Nenhuma organização ativa na sessão.');
}

function requireCtx(ctx: RequestContext | null): RequestContext {
  if (!ctx) throw noTenant();
  return ctx;
}

// ── Catálogo ─────────────────────────────────────────────────────────────────

export function useConnectorCatalog() {
  const ctx = useRequestContext();
  const query = useQuery({
    queryKey: [CATALOG_KEY],
    queryFn: () => listConnectors(requireCtx(ctx)),
    enabled: !!ctx,
  });
  return {
    connectors: query.data ?? [],
    isLoading: query.isLoading,
    error: (query.error as ArdenRepositoryError) ?? null,
    refetch: query.refetch,
  };
}

export function useConnectorTools(connectorKey?: string) {
  const ctx = useRequestContext();
  const query = useQuery({
    queryKey: [CATALOG_KEY, connectorKey, 'tools'],
    queryFn: () => listConnectorTools(requireCtx(ctx), connectorKey as string),
    enabled: !!connectorKey && !!ctx,
  });
  return {
    tools: query.data ?? [],
    isLoading: query.isLoading,
    error: (query.error as ArdenRepositoryError) ?? null,
  };
}

export function useConnectorDefinition(connectorKey?: string) {
  const ctx = useRequestContext();
  const query = useQuery({
    queryKey: [CATALOG_KEY, connectorKey],
    queryFn: () => getConnector(requireCtx(ctx), connectorKey as string),
    enabled: !!connectorKey && !!ctx,
  });
  return {
    connector: query.data,
    isLoading: query.isLoading,
    error: (query.error as ArdenRepositoryError) ?? null,
  };
}

// ── Conexões ─────────────────────────────────────────────────────────────────

export function useConnections(filters: Omit<ListConnectionsInput, 'signal'> = {}) {
  const { activeOrganization } = useTenant();
  const ctx = useRequestContext();
  const organizationId = activeOrganization?.id ?? '';
  const query = useQuery({
    queryKey: [CONNECTIONS_KEY, organizationId, filters],
    queryFn: () => listConnections(requireCtx(ctx), filters),
    enabled: !!organizationId && !!ctx,
  });
  return {
    connections: query.data?.items ?? [],
    hasNextPage: query.data?.hasNextPage ?? false,
    isLoading: query.isLoading,
    error: (query.error as ArdenRepositoryError) ?? null,
    refetch: query.refetch,
  };
}

export function useConnection(id?: string) {
  const { activeOrganization } = useTenant();
  const ctx = useRequestContext();
  const organizationId = activeOrganization?.id ?? '';
  const query = useQuery({
    queryKey: [CONNECTION_KEY, organizationId, id],
    queryFn: () => getConnection(requireCtx(ctx), id as string),
    enabled: !!id && !!organizationId && !!ctx,
  });
  return {
    connection: query.data,
    isLoading: query.isLoading,
    error: (query.error as ArdenRepositoryError) ?? null,
    refetch: query.refetch,
  };
}

function useConnectionsInvalidator() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: [CONNECTIONS_KEY] });
    void qc.invalidateQueries({ queryKey: [CONNECTION_KEY] });
  };
}

export function useCreateConnection() {
  const ctx = useRequestContext();
  const invalidate = useConnectionsInvalidator();
  return useMutation({
    mutationFn: (body: CreateConnectionRequest) => createConnection(requireCtx(ctx), body),
    onSuccess: invalidate,
  });
}

export function useUpdateConnection() {
  const ctx = useRequestContext();
  const invalidate = useConnectionsInvalidator();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateConnectionRequest }) =>
      updateConnection(requireCtx(ctx), id, body),
    onSuccess: invalidate,
  });
}

export function useTestConnection() {
  const ctx = useRequestContext();
  const invalidate = useConnectionsInvalidator();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body?: TestConnectionRequest }) =>
      testConnection(requireCtx(ctx), id, body),
    onSuccess: invalidate,
  });
}

export function useActivateConnection() {
  const ctx = useRequestContext();
  const invalidate = useConnectionsInvalidator();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: ConnectionCommandRequest }) =>
      activateConnection(requireCtx(ctx), id, body),
    onSuccess: invalidate,
  });
}

export function useSuspendConnection() {
  const ctx = useRequestContext();
  const invalidate = useConnectionsInvalidator();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: ConnectionCommandRequest }) =>
      suspendConnection(requireCtx(ctx), id, body),
    onSuccess: invalidate,
  });
}

export function useReactivateConnection() {
  const ctx = useRequestContext();
  const invalidate = useConnectionsInvalidator();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: ConnectionCommandRequest }) =>
      reactivateConnection(requireCtx(ctx), id, body),
    onSuccess: invalidate,
  });
}

export function useRevokeConnection() {
  const ctx = useRequestContext();
  const invalidate = useConnectionsInvalidator();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: ConnectionCommandRequest }) =>
      revokeConnection(requireCtx(ctx), id, body),
    onSuccess: invalidate,
  });
}

// ── Credenciais ──────────────────────────────────────────────────────────────

export function useCredentials(connectionId?: string) {
  const ctx = useRequestContext();
  const query = useQuery({
    queryKey: [CREDENTIALS_KEY, connectionId],
    queryFn: () => listCredentials(requireCtx(ctx), connectionId as string),
    enabled: !!connectionId && !!ctx,
  });
  return {
    credentials: query.data ?? [],
    isLoading: query.isLoading,
    error: (query.error as ArdenRepositoryError) ?? null,
    refetch: query.refetch,
  };
}

function useCredentialsInvalidator() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: [CREDENTIALS_KEY] });
    void qc.invalidateQueries({ queryKey: [CONNECTIONS_KEY] });
    void qc.invalidateQueries({ queryKey: [CONNECTION_KEY] });
  };
}

/** `connectionId` vai no payload da chamada — permite criar a credencial logo
 * após criar a conexão, sem precisar conhecer o id no momento de montar o hook. */
export function useCreateCredential() {
  const ctx = useRequestContext();
  const invalidate = useCredentialsInvalidator();
  return useMutation({
    mutationFn: ({ connectionId, body }: { connectionId: string; body: CreateConnectionCredentialRequest }) =>
      createCredential(requireCtx(ctx), connectionId, body),
    onSuccess: invalidate,
  });
}

export function useRotateCredential() {
  const ctx = useRequestContext();
  const invalidate = useCredentialsInvalidator();
  return useMutation({
    mutationFn: ({ connectionId, body }: { connectionId: string; body: RotateConnectionCredentialRequest }) =>
      rotateCredential(requireCtx(ctx), connectionId, body),
    onSuccess: invalidate,
  });
}

export function useRevokeCredential() {
  const ctx = useRequestContext();
  const invalidate = useCredentialsInvalidator();
  return useMutation({
    mutationFn: ({ connectionId, credentialVersionId }: { connectionId: string; credentialVersionId: string }) =>
      revokeCredential(requireCtx(ctx), connectionId, credentialVersionId),
    onSuccess: invalidate,
  });
}

// ── Vínculos de ferramenta (organização) ────────────────────────────────────

export function useToolBindings(filters: Omit<ListToolBindingsInput, 'signal'> = {}) {
  const { activeOrganization } = useTenant();
  const ctx = useRequestContext();
  const organizationId = activeOrganization?.id ?? '';
  const query = useQuery({
    queryKey: [TOOL_BINDINGS_KEY, organizationId, filters],
    queryFn: () => listToolBindings(requireCtx(ctx), filters),
    enabled: !!organizationId && !!ctx,
  });
  return {
    bindings: query.data?.items ?? [],
    hasNextPage: query.data?.hasNextPage ?? false,
    isLoading: query.isLoading,
    error: (query.error as ArdenRepositoryError) ?? null,
    refetch: query.refetch,
  };
}

function useToolBindingsInvalidator() {
  const qc = useQueryClient();
  return () => void qc.invalidateQueries({ queryKey: [TOOL_BINDINGS_KEY] });
}

export function useCreateToolBinding() {
  const ctx = useRequestContext();
  const invalidate = useToolBindingsInvalidator();
  return useMutation({
    mutationFn: (body: CreateOrganizationToolBindingRequest) => createToolBinding(requireCtx(ctx), body),
    onSuccess: invalidate,
  });
}

export function useUpdateToolBinding() {
  const ctx = useRequestContext();
  const invalidate = useToolBindingsInvalidator();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateOrganizationToolBindingRequest }) =>
      updateToolBinding(requireCtx(ctx), id, body),
    onSuccess: invalidate,
  });
}

export function useDisableToolBinding() {
  const ctx = useRequestContext();
  const invalidate = useToolBindingsInvalidator();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: ConnectionCommandRequest }) =>
      disableToolBinding(requireCtx(ctx), id, body),
    onSuccess: invalidate,
  });
}

// ── Vínculos de ferramenta (operação) ───────────────────────────────────────

export function useOperationToolBindings(operationId?: string) {
  const ctx = useRequestContext();
  const query = useQuery({
    queryKey: [OPERATION_TOOL_BINDINGS_KEY, operationId],
    queryFn: () => listOperationToolBindings(requireCtx(ctx), operationId as string),
    enabled: !!operationId && !!ctx,
  });
  return {
    bindings: query.data ?? [],
    isLoading: query.isLoading,
    error: (query.error as ArdenRepositoryError) ?? null,
    refetch: query.refetch,
  };
}

function useOperationToolBindingsInvalidator(operationId: string) {
  const qc = useQueryClient();
  return () => void qc.invalidateQueries({ queryKey: [OPERATION_TOOL_BINDINGS_KEY, operationId] });
}

export function useCreateOperationToolBinding(operationId: string) {
  const ctx = useRequestContext();
  const invalidate = useOperationToolBindingsInvalidator(operationId);
  return useMutation({
    mutationFn: (body: CreateOperationToolBindingRequest) =>
      createOperationToolBinding(requireCtx(ctx), operationId, body),
    onSuccess: invalidate,
  });
}

export function useUpdateOperationToolBinding(operationId: string) {
  const ctx = useRequestContext();
  const invalidate = useOperationToolBindingsInvalidator(operationId);
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateOperationToolBindingRequest }) =>
      updateOperationToolBinding(requireCtx(ctx), operationId, id, body),
    onSuccess: invalidate,
  });
}

export function useRemoveOperationToolBinding(operationId: string) {
  const ctx = useRequestContext();
  const invalidate = useOperationToolBindingsInvalidator(operationId);
  return useMutation({
    mutationFn: (bindingId: string) => removeOperationToolBinding(requireCtx(ctx), operationId, bindingId),
    onSuccess: invalidate,
  });
}

// ── Webhooks ─────────────────────────────────────────────────────────────────

export function useWebhookEndpoints(filters: Omit<ListWebhookEndpointsInput, 'signal'> = {}) {
  const { activeOrganization } = useTenant();
  const ctx = useRequestContext();
  const organizationId = activeOrganization?.id ?? '';
  const query = useQuery({
    queryKey: [WEBHOOKS_KEY, organizationId, filters],
    queryFn: () => listWebhookEndpoints(requireCtx(ctx), filters),
    enabled: !!organizationId && !!ctx,
  });
  return {
    endpoints: query.data?.items ?? [],
    hasNextPage: query.data?.hasNextPage ?? false,
    isLoading: query.isLoading,
    error: (query.error as ArdenRepositoryError) ?? null,
    refetch: query.refetch,
  };
}

function useWebhookEndpointsInvalidator() {
  const qc = useQueryClient();
  return () => void qc.invalidateQueries({ queryKey: [WEBHOOKS_KEY] });
}

/** Sucesso expõe o segredo (token/signingSecret) UMA vez — não é armazenado em cache. */
export function useCreateWebhookEndpoint() {
  const ctx = useRequestContext();
  const invalidate = useWebhookEndpointsInvalidator();
  return useMutation({
    mutationFn: (body: CreateWebhookEndpointRequest) => createWebhookEndpoint(requireCtx(ctx), body),
    onSuccess: invalidate,
  });
}

export function useUpdateWebhookEndpoint() {
  const ctx = useRequestContext();
  const invalidate = useWebhookEndpointsInvalidator();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateWebhookEndpointRequest }) =>
      updateWebhookEndpoint(requireCtx(ctx), id, body),
    onSuccess: invalidate,
  });
}

export function useSuspendWebhookEndpoint() {
  const ctx = useRequestContext();
  const invalidate = useWebhookEndpointsInvalidator();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: WebhookCommandRequest }) =>
      suspendWebhookEndpoint(requireCtx(ctx), id, body),
    onSuccess: invalidate,
  });
}

export function useReactivateWebhookEndpoint() {
  const ctx = useRequestContext();
  const invalidate = useWebhookEndpointsInvalidator();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: WebhookCommandRequest }) =>
      reactivateWebhookEndpoint(requireCtx(ctx), id, body),
    onSuccess: invalidate,
  });
}

export function useRevokeWebhookEndpoint() {
  const ctx = useRequestContext();
  const invalidate = useWebhookEndpointsInvalidator();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: WebhookCommandRequest }) =>
      revokeWebhookEndpoint(requireCtx(ctx), id, body),
    onSuccess: invalidate,
  });
}
