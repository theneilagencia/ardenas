/**
 * Arden.AS — cliente TypeScript da API v1 (ARDEN-FE-003).
 *
 * Interface do cliente DERIVADA dos contratos (`src/contracts`). Declarada
 * manualmente e coberta por um teste de compatibilidade que prova que os tipos do
 * contrato bastam para implementar `SessionRepository`, `OperationsRepository` e
 * `AuditRepository`. NÃO substitui os repositórios API existentes — é a prova de
 * que o contrato OpenAPI gera/tipa um cliente válido. Sem servidor, sem handlers.
 */

import type {
  AuditEvent,
  ListAuditEventsQuery,
  ListOperationsQuery,
  Operation,
  OperationVersion,
  PaginationMeta,
  SessionContext,
  SwitchOrganizationRequest,
  CreateOperationRequest,
  UpdateOperationRequest,
  DuplicateOperationRequest,
  ArchiveOperationRequest,
  OperationTransitionRequest,
  CreateOperationVersionRequest,
  UpdateOperationVersionRequest,
  PublishOperationVersionRequest,
  PublishOperationVersionResult,
  VersionComparison,
  AuthorityProfile,
  UpdateAuthorityProfileRequest,
  // Governança e aprovações (ARDEN-BE-004)
  Policy,
  PolicyVersion,
  OperationPolicyBinding,
  CreatePolicyRequest,
  UpdatePolicyRequest,
  CreatePolicyVersionRequest,
  UpdatePolicyVersionRequest,
  PublishPolicyVersionRequest,
  PolicyTransitionRequest,
  CreatePolicyBindingRequest,
  UpdatePolicyBindingRequest,
  ApprovalFlow,
  ApprovalRequest,
  ApprovalDelegation,
  CreateApprovalFlowRequest,
  UpdateApprovalFlowRequest,
  ApprovalFlowTransitionRequest,
  CreateApprovalRequestRequest,
  DecideApprovalRequest,
  CancelApprovalRequest,
  ListApprovalRequestsQuery,
  CreateApprovalDelegationRequest,
  RevokeApprovalDelegationRequest,
  ActionEvaluationResult,
  ActionValidationResult,
  ApprovalDecisionResult,
  EvaluateActionRequest,
  ValidateAuthorizationRequest,
  // Execução (ARDEN-BE-005)
  ExecutionRun,
  ExecutionStep,
  ExecutionEvent,
  EvidenceRecord,
  CreateExecutionRequest,
  ExecutionCommandRequest,
  ListExecutionsQuery,
  ListExecutionEventsQuery,
  // Conectores, credenciais, ferramentas e webhooks (ARDEN-BE-006)
  ConnectorDefinition,
  ConnectorToolDefinition,
  Connection,
  CreateConnectionRequest,
  UpdateConnectionRequest,
  TestConnectionRequest,
  TestConnectionResult,
  ConnectionCommandRequest,
  ListConnectionsQuery,
  CreateConnectionCredentialRequest,
  RotateConnectionCredentialRequest,
  CredentialMetadata,
  OrganizationToolBinding,
  CreateOrganizationToolBindingRequest,
  UpdateOrganizationToolBindingRequest,
  ListToolBindingsQuery,
  OperationToolBinding,
  CreateOperationToolBindingRequest,
  UpdateOperationToolBindingRequest,
  WebhookEndpoint,
  WebhookEndpointSecret,
  CreateWebhookEndpointRequest,
  UpdateWebhookEndpointRequest,
  WebhookCommandRequest,
  ListWebhookEndpointsQuery,
} from '@/contracts';

/** Paginação por cursor comum aos recursos de governança. */
export interface CursorPageQuery {
  cursor?: string;
  limit?: number;
}

/** Lista já desembrulhada (data + pagination). */
export interface ClientPage<T> {
  data: T[];
  pagination: PaginationMeta;
}

/** Opções por chamada: headers do protocolo v1 (idempotência/concorrência/rastreio). */
export interface CallOptions {
  idempotencyKey?: string;
  ifMatch?: string;
  correlationId?: string;
  signal?: AbortSignal;
}

/**
 * Cliente tipado da API v1. Retorna os payloads já desembrulhados (`data`). O
 * tenant vai no path e é validado pela sessão no backend; o cliente nunca envia
 * permissões.
 */
export interface ArdenApiV1Client {
  // Sessão
  getSession(opts?: CallOptions): Promise<SessionContext>;
  refreshSession(opts?: CallOptions): Promise<SessionContext>;
  switchOrganization(body: SwitchOrganizationRequest, opts?: CallOptions): Promise<SessionContext>;
  logout(opts?: CallOptions): Promise<void>;

  // Operações
  listOperations(
    organizationId: string,
    query: ListOperationsQuery,
    opts?: CallOptions,
  ): Promise<ClientPage<Operation>>;
  getOperation(organizationId: string, operationId: string, opts?: CallOptions): Promise<Operation>;
  createOperation(
    organizationId: string,
    body: CreateOperationRequest,
    opts: CallOptions & { idempotencyKey: string },
  ): Promise<Operation>;
  updateOperation(
    organizationId: string,
    operationId: string,
    body: UpdateOperationRequest,
    opts?: CallOptions,
  ): Promise<Operation>;
  archiveOperation(
    organizationId: string,
    operationId: string,
    body: ArchiveOperationRequest,
    opts: CallOptions & { idempotencyKey: string },
  ): Promise<Operation>;
  duplicateOperation(
    organizationId: string,
    operationId: string,
    body: DuplicateOperationRequest,
    opts: CallOptions & { idempotencyKey: string },
  ): Promise<Operation>;
  pauseOperation(
    organizationId: string,
    operationId: string,
    body: OperationTransitionRequest,
    opts?: CallOptions,
  ): Promise<Operation>;
  resumeOperation(
    organizationId: string,
    operationId: string,
    body: OperationTransitionRequest,
    opts?: CallOptions,
  ): Promise<Operation>;

  // Versões
  listOperationVersions(
    organizationId: string,
    operationId: string,
    opts?: CallOptions,
  ): Promise<ClientPage<OperationVersion>>;
  getOperationVersion(
    organizationId: string,
    operationId: string,
    versionId: string,
    opts?: CallOptions,
  ): Promise<OperationVersion>;
  createOperationVersion(
    organizationId: string,
    operationId: string,
    body: CreateOperationVersionRequest,
    opts: CallOptions & { idempotencyKey: string },
  ): Promise<OperationVersion>;
  updateOperationVersion(
    organizationId: string,
    operationId: string,
    versionId: string,
    body: UpdateOperationVersionRequest,
    opts?: CallOptions,
  ): Promise<OperationVersion>;
  publishOperationVersion(
    organizationId: string,
    operationId: string,
    versionId: string,
    body: PublishOperationVersionRequest,
    opts: CallOptions & { idempotencyKey: string },
  ): Promise<PublishOperationVersionResult>;
  compareOperationVersions(
    organizationId: string,
    operationId: string,
    versionId: string,
    otherVersionId: string,
    opts?: CallOptions,
  ): Promise<VersionComparison>;

  // Gradiente de Autoridade
  getAuthorityProfile(
    organizationId: string,
    operationId: string,
    versionId: string,
    opts?: CallOptions,
  ): Promise<AuthorityProfile>;
  updateAuthorityProfile(
    organizationId: string,
    operationId: string,
    versionId: string,
    body: UpdateAuthorityProfileRequest,
    opts?: CallOptions,
  ): Promise<OperationVersion>;

  // Auditoria (somente leitura)
  listAuditEvents(
    organizationId: string,
    query: ListAuditEventsQuery,
    opts?: CallOptions,
  ): Promise<ClientPage<AuditEvent>>;
  getAuditEvent(
    organizationId: string,
    eventId: string,
    opts?: CallOptions,
  ): Promise<AuditEvent>;

  // ── Governança: políticas (ARDEN-BE-004) ────────────────────────────────────
  listPolicies(organizationId: string, query: CursorPageQuery, opts?: CallOptions): Promise<ClientPage<Policy>>;
  getPolicy(organizationId: string, policyId: string, opts?: CallOptions): Promise<Policy>;
  createPolicy(organizationId: string, body: CreatePolicyRequest, opts: CallOptions & { idempotencyKey: string }): Promise<Policy>;
  updatePolicy(organizationId: string, policyId: string, body: UpdatePolicyRequest, opts?: CallOptions): Promise<Policy>;
  createPolicyVersion(organizationId: string, policyId: string, body: CreatePolicyVersionRequest, opts: CallOptions & { idempotencyKey: string }): Promise<PolicyVersion>;
  updatePolicyVersion(organizationId: string, policyId: string, versionId: string, body: UpdatePolicyVersionRequest, opts?: CallOptions): Promise<PolicyVersion>;
  publishPolicyVersion(organizationId: string, policyId: string, versionId: string, body: PublishPolicyVersionRequest, opts: CallOptions & { idempotencyKey: string }): Promise<PolicyVersion>;
  suspendPolicy(organizationId: string, policyId: string, body: PolicyTransitionRequest, opts: CallOptions & { idempotencyKey: string }): Promise<Policy>;
  archivePolicy(organizationId: string, policyId: string, body: PolicyTransitionRequest, opts: CallOptions & { idempotencyKey: string }): Promise<Policy>;
  listPolicyBindings(organizationId: string, operationId: string, opts?: CallOptions): Promise<OperationPolicyBinding[]>;
  createPolicyBinding(organizationId: string, operationId: string, body: CreatePolicyBindingRequest, opts: CallOptions & { idempotencyKey: string }): Promise<OperationPolicyBinding>;
  updatePolicyBinding(organizationId: string, operationId: string, bindingId: string, body: UpdatePolicyBindingRequest, opts?: CallOptions): Promise<OperationPolicyBinding>;
  deletePolicyBinding(organizationId: string, operationId: string, bindingId: string, opts?: CallOptions): Promise<OperationPolicyBinding>;

  // ── Aprovações: fluxos, solicitações, delegações (ARDEN-BE-004) ──────────────
  listApprovalFlows(organizationId: string, query: CursorPageQuery, opts?: CallOptions): Promise<ClientPage<ApprovalFlow>>;
  getApprovalFlow(organizationId: string, flowId: string, opts?: CallOptions): Promise<ApprovalFlow>;
  createApprovalFlow(organizationId: string, body: CreateApprovalFlowRequest, opts: CallOptions & { idempotencyKey: string }): Promise<ApprovalFlow>;
  updateApprovalFlow(organizationId: string, flowId: string, body: UpdateApprovalFlowRequest, opts?: CallOptions): Promise<ApprovalFlow>;
  activateApprovalFlow(organizationId: string, flowId: string, body: ApprovalFlowTransitionRequest, opts: CallOptions & { idempotencyKey: string }): Promise<ApprovalFlow>;
  suspendApprovalFlow(organizationId: string, flowId: string, body: ApprovalFlowTransitionRequest, opts: CallOptions & { idempotencyKey: string }): Promise<ApprovalFlow>;
  listApprovalRequests(organizationId: string, query: ListApprovalRequestsQuery, opts?: CallOptions): Promise<ClientPage<ApprovalRequest>>;
  getApprovalRequest(organizationId: string, requestId: string, opts?: CallOptions): Promise<ApprovalRequest>;
  createApprovalRequest(organizationId: string, operationId: string, body: CreateApprovalRequestRequest, opts: CallOptions & { idempotencyKey: string }): Promise<ApprovalRequest>;
  approveApprovalRequest(organizationId: string, requestId: string, body: DecideApprovalRequest, opts?: CallOptions): Promise<ApprovalDecisionResult>;
  rejectApprovalRequest(organizationId: string, requestId: string, body: DecideApprovalRequest, opts?: CallOptions): Promise<ApprovalRequest>;
  cancelApprovalRequest(organizationId: string, requestId: string, body: CancelApprovalRequest, opts?: CallOptions): Promise<ApprovalRequest>;
  listApprovalDelegations(organizationId: string, opts?: CallOptions): Promise<ApprovalDelegation[]>;
  createApprovalDelegation(organizationId: string, body: CreateApprovalDelegationRequest, opts: CallOptions & { idempotencyKey: string }): Promise<ApprovalDelegation>;
  revokeApprovalDelegation(organizationId: string, delegationId: string, body: RevokeApprovalDelegationRequest, opts: CallOptions & { idempotencyKey: string }): Promise<ApprovalDelegation>;

  // ── Enforcement de autoridade (ARDEN-BE-004) ─────────────────────────────────
  evaluateAction(organizationId: string, operationId: string, body: EvaluateActionRequest, opts?: CallOptions): Promise<ActionEvaluationResult>;
  validateAuthorization(organizationId: string, body: ValidateAuthorizationRequest, opts?: CallOptions): Promise<ActionValidationResult>;

  // ── Execução (ARDEN-BE-005) ──────────────────────────────────────────────────
  listExecutions(organizationId: string, query: ListExecutionsQuery, opts?: CallOptions): Promise<ClientPage<ExecutionRun>>;
  createExecution(organizationId: string, operationId: string, body: CreateExecutionRequest, opts: CallOptions & { idempotencyKey: string }): Promise<ExecutionRun>;
  getExecution(organizationId: string, executionId: string, opts?: CallOptions): Promise<ExecutionRun>;
  pauseExecution(organizationId: string, executionId: string, body: ExecutionCommandRequest, opts?: CallOptions): Promise<ExecutionRun>;
  resumeExecution(organizationId: string, executionId: string, body: ExecutionCommandRequest, opts?: CallOptions): Promise<ExecutionRun>;
  cancelExecution(organizationId: string, executionId: string, body: ExecutionCommandRequest, opts?: CallOptions): Promise<ExecutionRun>;
  retryExecution(organizationId: string, executionId: string, body: ExecutionCommandRequest, opts?: CallOptions): Promise<ExecutionRun>;
  listExecutionSteps(organizationId: string, executionId: string, opts?: CallOptions): Promise<ExecutionStep[]>;
  getExecutionStep(organizationId: string, executionId: string, stepId: string, opts?: CallOptions): Promise<ExecutionStep>;
  listExecutionEvents(organizationId: string, executionId: string, query: ListExecutionEventsQuery, opts?: CallOptions): Promise<ClientPage<ExecutionEvent>>;
  listExecutionEvidence(organizationId: string, executionId: string, opts?: CallOptions): Promise<EvidenceRecord[]>;
  getExecutionEvidence(organizationId: string, executionId: string, evidenceId: string, opts?: CallOptions): Promise<EvidenceRecord>;

  // ── Conectores: catálogo (público) (ARDEN-BE-006) ────────────────────────────
  listConnectors(opts?: CallOptions): Promise<ConnectorDefinition[]>;
  getConnector(connectorKey: string, opts?: CallOptions): Promise<ConnectorDefinition>;
  listConnectorTools(connectorKey: string, opts?: CallOptions): Promise<ConnectorToolDefinition[]>;

  // ── Conexões ─────────────────────────────────────────────────────────────────
  listConnections(organizationId: string, query: ListConnectionsQuery, opts?: CallOptions): Promise<ClientPage<Connection>>;
  createConnection(organizationId: string, body: CreateConnectionRequest, opts: CallOptions & { idempotencyKey: string }): Promise<Connection>;
  getConnection(organizationId: string, connectionId: string, opts?: CallOptions): Promise<Connection>;
  updateConnection(organizationId: string, connectionId: string, body: UpdateConnectionRequest, opts?: CallOptions): Promise<Connection>;
  testConnection(organizationId: string, connectionId: string, body: TestConnectionRequest, opts: CallOptions & { idempotencyKey: string }): Promise<TestConnectionResult>;
  activateConnection(organizationId: string, connectionId: string, body: ConnectionCommandRequest, opts: CallOptions & { idempotencyKey: string }): Promise<Connection>;
  suspendConnection(organizationId: string, connectionId: string, body: ConnectionCommandRequest, opts: CallOptions & { idempotencyKey: string }): Promise<Connection>;
  reactivateConnection(organizationId: string, connectionId: string, body: ConnectionCommandRequest, opts: CallOptions & { idempotencyKey: string }): Promise<Connection>;
  revokeConnection(organizationId: string, connectionId: string, body: ConnectionCommandRequest, opts: CallOptions & { idempotencyKey: string }): Promise<Connection>;

  // ── Credenciais (request sensível; response só metadados) ─────────────────────
  listCredentials(organizationId: string, connectionId: string, opts?: CallOptions): Promise<ClientPage<CredentialMetadata>>;
  createCredential(organizationId: string, connectionId: string, body: CreateConnectionCredentialRequest, opts: CallOptions & { idempotencyKey: string }): Promise<CredentialMetadata>;
  rotateCredential(organizationId: string, connectionId: string, body: RotateConnectionCredentialRequest, opts: CallOptions & { idempotencyKey: string }): Promise<CredentialMetadata>;
  revokeCredential(organizationId: string, connectionId: string, credentialVersionId: string, opts: CallOptions & { idempotencyKey: string }): Promise<CredentialMetadata>;

  // ── Tool bindings ────────────────────────────────────────────────────────────
  listToolBindings(organizationId: string, query: ListToolBindingsQuery, opts?: CallOptions): Promise<ClientPage<OrganizationToolBinding>>;
  createToolBinding(organizationId: string, body: CreateOrganizationToolBindingRequest, opts: CallOptions & { idempotencyKey: string }): Promise<OrganizationToolBinding>;
  getToolBinding(organizationId: string, bindingId: string, opts?: CallOptions): Promise<OrganizationToolBinding>;
  updateToolBinding(organizationId: string, bindingId: string, body: UpdateOrganizationToolBindingRequest, opts?: CallOptions): Promise<OrganizationToolBinding>;
  disableToolBinding(organizationId: string, bindingId: string, body: ConnectionCommandRequest, opts: CallOptions & { idempotencyKey: string }): Promise<OrganizationToolBinding>;

  // ── Operation bindings ───────────────────────────────────────────────────────
  listOperationToolBindings(organizationId: string, operationId: string, opts?: CallOptions): Promise<OperationToolBinding[]>;
  createOperationToolBinding(organizationId: string, operationId: string, body: CreateOperationToolBindingRequest, opts: CallOptions & { idempotencyKey: string }): Promise<OperationToolBinding>;
  updateOperationToolBinding(organizationId: string, operationId: string, bindingId: string, body: UpdateOperationToolBindingRequest, opts?: CallOptions): Promise<OperationToolBinding>;
  removeOperationToolBinding(organizationId: string, operationId: string, bindingId: string, opts?: CallOptions): Promise<OperationToolBinding>;

  // ── Webhooks ─────────────────────────────────────────────────────────────────
  listWebhookEndpoints(organizationId: string, query: ListWebhookEndpointsQuery, opts?: CallOptions): Promise<ClientPage<WebhookEndpoint>>;
  createWebhookEndpoint(organizationId: string, body: CreateWebhookEndpointRequest, opts: CallOptions & { idempotencyKey: string }): Promise<WebhookEndpointSecret>;
  getWebhookEndpoint(organizationId: string, webhookEndpointId: string, opts?: CallOptions): Promise<WebhookEndpoint>;
  updateWebhookEndpoint(organizationId: string, webhookEndpointId: string, body: UpdateWebhookEndpointRequest, opts?: CallOptions): Promise<WebhookEndpoint>;
  suspendWebhookEndpoint(organizationId: string, webhookEndpointId: string, body: WebhookCommandRequest, opts: CallOptions & { idempotencyKey: string }): Promise<WebhookEndpoint>;
  reactivateWebhookEndpoint(organizationId: string, webhookEndpointId: string, body: WebhookCommandRequest, opts: CallOptions & { idempotencyKey: string }): Promise<WebhookEndpoint>;
  revokeWebhookEndpoint(organizationId: string, webhookEndpointId: string, body: WebhookCommandRequest, opts: CallOptions & { idempotencyKey: string }): Promise<WebhookEndpoint>;
}
