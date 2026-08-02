/**
 * Arden.AS — contratos de dados.
 * O frontend consome interfaces, nunca `fetch` direto.
 * Cada domínio tem Mock / IndexedDb / Api implementando o mesmo contrato.
 */

import type {
  ApprovalState,
  AppNotification,
  Approval,
  Area,
  Assessment,
  AuditEvent,
  AuthorityMatrixRow,
  Budget,
  Company,
  ContextSource,
  CostCenter,
  Deployment,
  Evidence,
  Execution,
  Integration,
  ManagedFile,
  Operation,
  OperationException,
  Organization,
  Person,
  Policy,
  ResultIndicator,
  Risk,
  Role,
  Team,
  Unit,
  WorkUnitLedger,
  WorkUnitRequest,
} from '@/domain/types';
import type {
  ConnectorDefinition,
  ConnectorToolDefinition,
  Connection,
  ConnectorKey,
  ConnectionStatus,
  CreateConnectionRequest,
  UpdateConnectionRequest,
  TestConnectionRequest,
  TestConnectionResult,
  ConnectionCommandRequest,
  CredentialMetadata,
  CreateConnectionCredentialRequest,
  RotateConnectionCredentialRequest,
  OrganizationToolBinding,
  CreateOrganizationToolBindingRequest,
  UpdateOrganizationToolBindingRequest,
  OperationToolBinding,
  CreateOperationToolBindingRequest,
  UpdateOperationToolBindingRequest,
  WebhookEndpoint,
  WebhookEndpointSecret,
  WebhookEndpointStatus,
  CreateWebhookEndpointRequest,
  UpdateWebhookEndpointRequest,
  WebhookCommandRequest,
} from '@/contracts';

export interface ApiResponse<T> {
  data: T;
  meta?: { page?: number; pageSize?: number; total?: number };
}

export interface ApiError {
  code: string;
  message: string;
  fieldErrors?: Record<string, string[]>;
  correlationId?: string;
  details?: unknown;
}

export interface PaginatedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

export interface ListOperationsInput {
  organizationId: string;
  status?: string;
  search?: string;
  page?: number;
  pageSize?: number;
  signal?: AbortSignal;
}

/** Rascunho criado pelo wizard (o domínio já monta o objeto Operation). */
export type CreateOperationInput = Operation;
export type UpdateOperationDraftInput = Partial<Operation>;

export interface CreateFromAssessmentInput {
  assessmentId: string;
  operationName: string;
  discipline: string;
  execScore: number;
  responsibleId: string;
  organizationId: string;
  companyId?: string;
}

/**
 * Contrato do agregado Operação. Todo método aceita AbortSignal quando aplicável.
 * `publishVersion` é comando explícito — publicar não é atualização de campo.
 */
export interface OperationsRepository {
  list(input: ListOperationsInput): Promise<PaginatedResult<Operation>>;
  getById(id: string, signal?: AbortSignal): Promise<Operation>;
  create(input: CreateOperationInput): Promise<Operation>;
  updateDraft(id: string, input: UpdateOperationDraftInput): Promise<Operation>;
  createVersion(id: string): Promise<Operation>;
  publishVersion(id: string): Promise<Operation>;
  pause(id: string): Promise<Operation>;
  resume(id: string): Promise<Operation>;
  archive(id: string): Promise<void>;
  duplicate(id: string): Promise<Operation>;
  createFromAssessment(input: CreateFromAssessmentInput): Promise<Operation>;
}

export interface AuditQuery {
  organizationId: string;
  result?: AuditEvent['result'];
  signal?: AbortSignal;
}

/** Fronteira única de escrita/leitura de eventos de auditoria. */
export interface AuditRepository {
  list(input: AuditQuery): Promise<AuditEvent[]>;
  append(event: AuditEvent): Promise<AuditEvent>;
}

/** Ponto único de composição das dependências de dados. */
export interface ArdenServices {
  operations: OperationsRepository;
  audit: AuditRepository;
  approvals: ApprovalsRepository;
  files: FilesRepository;
  connectors: ConnectorsRepository;
}

/**
 * O snapshot completo do domínio. É o formato que o provider (memória ou
 * IndexedDB) carrega e persiste. O store global mantém a fonte da verdade em
 * memória e escreve através do provider a cada mutação.
 */
export interface DomainSnapshot {
  organizations: Organization[];
  companies: Company[];
  units: Unit[];
  areas: Area[];
  teams: Team[];
  costCenters: CostCenter[];
  people: Person[];
  roles: Role[];
  operations: Operation[];
  executions: Execution[];
  approvals: Approval[];
  exceptions: OperationException[];
  evidence: Evidence[];
  policies: Policy[];
  risks: Risk[];
  integrations: Integration[];
  contextSources: ContextSource[];
  files: ManagedFile[];
  workUnits: WorkUnitLedger[];
  budgets: Budget[];
  workUnitRequests: WorkUnitRequest[];
  auditEvents: AuditEvent[];
  deployments: Deployment[];
  notifications: AppNotification[];
  resultIndicators: ResultIndicator[];
  authorityMatrix: AuthorityMatrixRow[];
  assessments: Assessment[];
}

export type ApprovalDecision = Extract<
  ApprovalState,
  'approved' | 'rejected' | 'changes_requested' | 'delegated'
>;

export interface ApprovalsRepository {
  list(signal?: AbortSignal): Promise<Approval[]>;
  approve(id: string, justification?: string): Promise<Approval>;
  reject(id: string, justification?: string): Promise<Approval>;
  requestChanges(id: string, justification?: string): Promise<Approval>;
  delegate(id: string, toPersonId: string): Promise<Approval>;
}

/** Página por CURSOR — usada pelos recursos de conectores (ARDEN-BE-006.8). */
export interface CursorPage<T> {
  items: T[];
  cursor: string | null;
  hasNextPage: boolean;
}

export interface ListConnectionsInput {
  connectorKey?: ConnectorKey;
  status?: ConnectionStatus;
  search?: string;
  cursor?: string;
  limit?: number;
  signal?: AbortSignal;
}

export interface ListToolBindingsInput {
  connectionId?: string;
  enabled?: boolean;
  connectorKey?: ConnectorKey;
  toolKey?: string;
  cursor?: string;
  limit?: number;
  signal?: AbortSignal;
}

export interface ListWebhookEndpointsInput {
  status?: WebhookEndpointStatus;
  connectionId?: string;
  operationId?: string;
  cursor?: string;
  limit?: number;
  signal?: AbortSignal;
}

/**
 * Fronteira única de conectores/conexões/credenciais/vínculos/webhooks
 * (ARDEN-BE-006.8). O tenant NUNCA vem de parâmetro — é sempre derivado da sessão
 * ativa pela implementação concreta (ver `requireOrg()` em `v1-connectors-repository`).
 * Segredos (credencial, token de webhook) só trafegam nos requests de escrita —
 * nunca aparecem no retorno de leitura.
 */
export interface ConnectorsRepository {
  // Catálogo (público, somente leitura).
  listConnectors(signal?: AbortSignal): Promise<ConnectorDefinition[]>;
  getConnector(connectorKey: string, signal?: AbortSignal): Promise<ConnectorDefinition>;
  listConnectorTools(connectorKey: string, signal?: AbortSignal): Promise<ConnectorToolDefinition[]>;

  // Conexões.
  listConnections(input?: ListConnectionsInput): Promise<CursorPage<Connection>>;
  createConnection(body: CreateConnectionRequest): Promise<Connection>;
  getConnection(connectionId: string, signal?: AbortSignal): Promise<Connection>;
  updateConnection(connectionId: string, body: UpdateConnectionRequest): Promise<Connection>;
  testConnection(connectionId: string, body?: TestConnectionRequest): Promise<TestConnectionResult>;
  activateConnection(connectionId: string, body: ConnectionCommandRequest): Promise<Connection>;
  suspendConnection(connectionId: string, body: ConnectionCommandRequest): Promise<Connection>;
  reactivateConnection(connectionId: string, body: ConnectionCommandRequest): Promise<Connection>;
  revokeConnection(connectionId: string, body: ConnectionCommandRequest): Promise<Connection>;

  // Credenciais (request sensível; resposta só metadados).
  listCredentials(connectionId: string, signal?: AbortSignal): Promise<CredentialMetadata[]>;
  createCredential(connectionId: string, body: CreateConnectionCredentialRequest): Promise<CredentialMetadata>;
  rotateCredential(connectionId: string, body: RotateConnectionCredentialRequest): Promise<CredentialMetadata>;
  revokeCredential(connectionId: string, credentialVersionId: string): Promise<CredentialMetadata>;

  // Vínculos de ferramenta (organização).
  listToolBindings(input?: ListToolBindingsInput): Promise<CursorPage<OrganizationToolBinding>>;
  createToolBinding(body: CreateOrganizationToolBindingRequest): Promise<OrganizationToolBinding>;
  getToolBinding(bindingId: string, signal?: AbortSignal): Promise<OrganizationToolBinding>;
  updateToolBinding(bindingId: string, body: UpdateOrganizationToolBindingRequest): Promise<OrganizationToolBinding>;
  disableToolBinding(bindingId: string, body: ConnectionCommandRequest): Promise<OrganizationToolBinding>;

  // Vínculos de ferramenta (operação).
  listOperationToolBindings(operationId: string, signal?: AbortSignal): Promise<OperationToolBinding[]>;
  createOperationToolBinding(
    operationId: string,
    body: CreateOperationToolBindingRequest,
  ): Promise<OperationToolBinding>;
  updateOperationToolBinding(
    operationId: string,
    bindingId: string,
    body: UpdateOperationToolBindingRequest,
  ): Promise<OperationToolBinding>;
  removeOperationToolBinding(operationId: string, bindingId: string): Promise<OperationToolBinding>;

  // Webhooks.
  listWebhookEndpoints(input?: ListWebhookEndpointsInput): Promise<CursorPage<WebhookEndpoint>>;
  createWebhookEndpoint(body: CreateWebhookEndpointRequest): Promise<WebhookEndpointSecret>;
  getWebhookEndpoint(webhookEndpointId: string, signal?: AbortSignal): Promise<WebhookEndpoint>;
  updateWebhookEndpoint(webhookEndpointId: string, body: UpdateWebhookEndpointRequest): Promise<WebhookEndpoint>;
  suspendWebhookEndpoint(webhookEndpointId: string, body: WebhookCommandRequest): Promise<WebhookEndpoint>;
  reactivateWebhookEndpoint(webhookEndpointId: string, body: WebhookCommandRequest): Promise<WebhookEndpoint>;
  revokeWebhookEndpoint(webhookEndpointId: string, body: WebhookCommandRequest): Promise<WebhookEndpoint>;
}

export interface FilesRepository {
  candidates(signal?: AbortSignal): Promise<ManagedFile[]>;
  quarantine(id: string): Promise<ManagedFile>;
  restore(id: string): Promise<ManagedFile>;
  requestDeletion(id: string, approverId: string): Promise<ManagedFile>;
  approveDeletion(id: string, approverId: string): Promise<ManagedFile>;
}

/**
 * Provider de dados intercambiável. A troca é por configuração
 * (VITE_DATA_PROVIDER) — nenhum componente sabe qual implementação está ativa.
 */
export interface DataProvider {
  readonly kind: 'mock' | 'indexeddb' | 'api';
  load(): Promise<DomainSnapshot>;
  persist(snapshot: DomainSnapshot): Promise<void>;
  clear(): Promise<void>;
}
