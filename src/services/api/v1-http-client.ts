/**
 * Arden.AS — cliente HTTP concreto da API v1 (ARDEN-BE-003).
 *
 * Implementa `ArdenApiV1Client` sobre o `ApiClient` (fetch + token + baseUrl). O
 * tenant vai no PATH (`/organizations/{orgId}/...`) e é validado no backend; o
 * cliente NUNCA envia permissões. Headers de protocolo: `Idempotency-Key` e
 * `If-Match` por chamada. Usado somente no modo `api`.
 */

import type { ApiClient } from '../api-client';
import type {
  AuditEvent,
  ListAuditEventsQuery,
  ListOperationsQuery,
  Operation,
  OperationVersion,
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
  PaginationMeta,
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
  ExecutionRun,
  ExecutionStep,
  ExecutionEvent,
  EvidenceRecord,
  CreateExecutionRequest,
  ExecutionCommandRequest,
  ListExecutionsQuery,
  ListExecutionEventsQuery,
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
import type { ArdenApiV1Client, ClientPage, CallOptions, CursorPageQuery } from './generated/api-v1-client';

interface ListEnvelope<T> {
  data: T[];
  pagination: PaginationMeta;
}

function query(params: Record<string, unknown>): string {
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') search.set(k, String(v));
  }
  const s = search.toString();
  return s ? `?${s}` : '';
}

function headers(opts?: CallOptions): Record<string, string> {
  const h: Record<string, string> = {};
  if (opts?.idempotencyKey) h['Idempotency-Key'] = opts.idempotencyKey;
  if (opts?.ifMatch) h['If-Match'] = opts.ifMatch;
  if (opts?.correlationId) h['X-Correlation-Id'] = opts.correlationId;
  return h;
}

export class ApiV1HttpClient implements ArdenApiV1Client {
  constructor(private readonly http: ApiClient) {}

  private base(organizationId: string): string {
    return `/organizations/${organizationId}`;
  }

  private async get<T>(path: string, opts?: CallOptions): Promise<T> {
    const res = await this.http.request<T>(path, { method: 'GET', headers: headers(opts), signal: opts?.signal });
    return res.data;
  }

  private async send<T>(method: string, path: string, body: unknown, opts?: CallOptions): Promise<T> {
    const res = await this.http.request<T>(path, {
      method,
      headers: headers(opts),
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: opts?.signal,
    });
    return res.data;
  }

  private async list<T>(path: string, opts?: CallOptions): Promise<ClientPage<T>> {
    const res = (await this.http.request<T[]>(path, {
      method: 'GET',
      headers: headers(opts),
      signal: opts?.signal,
    })) as unknown as ListEnvelope<T>;
    return { data: res.data, pagination: res.pagination };
  }

  // ── Sessão (delegada ao contrato; usada pela prova de compatibilidade) ─────────
  getSession(opts?: CallOptions) {
    return this.get<SessionContext>('/session', opts);
  }
  refreshSession(opts?: CallOptions) {
    return this.send<SessionContext>('POST', '/session/refresh', undefined, opts);
  }
  switchOrganization(body: SwitchOrganizationRequest, opts?: CallOptions) {
    return this.send<SessionContext>('POST', '/session/switch-organization', body, opts);
  }
  async logout(opts?: CallOptions) {
    await this.send<void>('POST', '/session/logout', undefined, opts);
  }

  // ── Operações ──────────────────────────────────────────────────────────────────
  listOperations(organizationId: string, q: ListOperationsQuery, opts?: CallOptions) {
    return this.list<Operation>(`${this.base(organizationId)}/operations${query(q)}`, opts);
  }
  getOperation(organizationId: string, operationId: string, opts?: CallOptions) {
    return this.get<Operation>(`${this.base(organizationId)}/operations/${operationId}`, opts);
  }
  createOperation(organizationId: string, body: CreateOperationRequest, opts: CallOptions & { idempotencyKey: string }) {
    return this.send<Operation>('POST', `${this.base(organizationId)}/operations`, body, opts);
  }
  updateOperation(organizationId: string, operationId: string, body: UpdateOperationRequest, opts?: CallOptions) {
    return this.send<Operation>('PATCH', `${this.base(organizationId)}/operations/${operationId}`, body, opts);
  }
  archiveOperation(organizationId: string, operationId: string, body: ArchiveOperationRequest, opts: CallOptions & { idempotencyKey: string }) {
    return this.send<Operation>('POST', `${this.base(organizationId)}/operations/${operationId}/archive`, body, opts);
  }
  duplicateOperation(organizationId: string, operationId: string, body: DuplicateOperationRequest, opts: CallOptions & { idempotencyKey: string }) {
    return this.send<Operation>('POST', `${this.base(organizationId)}/operations/${operationId}/duplicate`, body, opts);
  }
  pauseOperation(organizationId: string, operationId: string, body: OperationTransitionRequest, opts?: CallOptions) {
    return this.send<Operation>('POST', `${this.base(organizationId)}/operations/${operationId}/pause`, body, opts);
  }
  resumeOperation(organizationId: string, operationId: string, body: OperationTransitionRequest, opts?: CallOptions) {
    return this.send<Operation>('POST', `${this.base(organizationId)}/operations/${operationId}/resume`, body, opts);
  }

  // ── Versões ──────────────────────────────────────────────────────────────────
  listOperationVersions(organizationId: string, operationId: string, opts?: CallOptions) {
    return this.list<OperationVersion>(`${this.base(organizationId)}/operations/${operationId}/versions`, opts);
  }
  getOperationVersion(organizationId: string, operationId: string, versionId: string, opts?: CallOptions) {
    return this.get<OperationVersion>(`${this.base(organizationId)}/operations/${operationId}/versions/${versionId}`, opts);
  }
  createOperationVersion(organizationId: string, operationId: string, body: CreateOperationVersionRequest, opts: CallOptions & { idempotencyKey: string }) {
    return this.send<OperationVersion>('POST', `${this.base(organizationId)}/operations/${operationId}/versions`, body, opts);
  }
  updateOperationVersion(organizationId: string, operationId: string, versionId: string, body: UpdateOperationVersionRequest, opts?: CallOptions) {
    return this.send<OperationVersion>('PATCH', `${this.base(organizationId)}/operations/${operationId}/versions/${versionId}`, body, opts);
  }
  publishOperationVersion(organizationId: string, operationId: string, versionId: string, body: PublishOperationVersionRequest, opts: CallOptions & { idempotencyKey: string }) {
    return this.send<PublishOperationVersionResult>('POST', `${this.base(organizationId)}/operations/${operationId}/versions/${versionId}/publish`, body, opts);
  }
  compareOperationVersions(organizationId: string, operationId: string, versionId: string, otherVersionId: string, opts?: CallOptions) {
    return this.get<VersionComparison>(`${this.base(organizationId)}/operations/${operationId}/versions/${versionId}/compare/${otherVersionId}`, opts);
  }

  // ── Gradiente de Autoridade ────────────────────────────────────────────────────
  getAuthorityProfile(organizationId: string, operationId: string, versionId: string, opts?: CallOptions) {
    return this.get<AuthorityProfile>(`${this.base(organizationId)}/operations/${operationId}/versions/${versionId}/authority`, opts);
  }
  updateAuthorityProfile(organizationId: string, operationId: string, versionId: string, body: UpdateAuthorityProfileRequest, opts?: CallOptions) {
    return this.send<OperationVersion>('PATCH', `${this.base(organizationId)}/operations/${operationId}/versions/${versionId}/authority`, body, opts);
  }

  // ── Auditoria (somente leitura) ────────────────────────────────────────────────
  listAuditEvents(organizationId: string, q: ListAuditEventsQuery, opts?: CallOptions) {
    return this.list<AuditEvent>(`${this.base(organizationId)}/audit-events${query(q)}`, opts);
  }
  getAuditEvent(organizationId: string, eventId: string, opts?: CallOptions) {
    return this.get<AuditEvent>(`${this.base(organizationId)}/audit-events/${eventId}`, opts);
  }

  // ── Governança: políticas (ARDEN-BE-004) ────────────────────────────────────
  listPolicies(organizationId: string, q: CursorPageQuery, opts?: CallOptions) {
    return this.list<Policy>(`${this.base(organizationId)}/policies${query(q as Record<string, unknown>)}`, opts);
  }
  getPolicy(organizationId: string, policyId: string, opts?: CallOptions) {
    return this.get<Policy>(`${this.base(organizationId)}/policies/${policyId}`, opts);
  }
  createPolicy(organizationId: string, body: CreatePolicyRequest, opts: CallOptions & { idempotencyKey: string }) {
    return this.send<Policy>('POST', `${this.base(organizationId)}/policies`, body, opts);
  }
  updatePolicy(organizationId: string, policyId: string, body: UpdatePolicyRequest, opts?: CallOptions) {
    return this.send<Policy>('PATCH', `${this.base(organizationId)}/policies/${policyId}`, body, opts);
  }
  createPolicyVersion(organizationId: string, policyId: string, body: CreatePolicyVersionRequest, opts: CallOptions & { idempotencyKey: string }) {
    return this.send<PolicyVersion>('POST', `${this.base(organizationId)}/policies/${policyId}/versions`, body, opts);
  }
  updatePolicyVersion(organizationId: string, policyId: string, versionId: string, body: UpdatePolicyVersionRequest, opts?: CallOptions) {
    return this.send<PolicyVersion>('PATCH', `${this.base(organizationId)}/policies/${policyId}/versions/${versionId}`, body, opts);
  }
  publishPolicyVersion(organizationId: string, policyId: string, versionId: string, body: PublishPolicyVersionRequest, opts: CallOptions & { idempotencyKey: string }) {
    return this.send<PolicyVersion>('POST', `${this.base(organizationId)}/policies/${policyId}/versions/${versionId}/publish`, body, opts);
  }
  suspendPolicy(organizationId: string, policyId: string, body: PolicyTransitionRequest, opts: CallOptions & { idempotencyKey: string }) {
    return this.send<Policy>('POST', `${this.base(organizationId)}/policies/${policyId}/suspend`, body, opts);
  }
  archivePolicy(organizationId: string, policyId: string, body: PolicyTransitionRequest, opts: CallOptions & { idempotencyKey: string }) {
    return this.send<Policy>('POST', `${this.base(organizationId)}/policies/${policyId}/archive`, body, opts);
  }
  listPolicyBindings(organizationId: string, operationId: string, opts?: CallOptions) {
    return this.get<OperationPolicyBinding[]>(`${this.base(organizationId)}/operations/${operationId}/policy-bindings`, opts);
  }
  createPolicyBinding(organizationId: string, operationId: string, body: CreatePolicyBindingRequest, opts: CallOptions & { idempotencyKey: string }) {
    return this.send<OperationPolicyBinding>('POST', `${this.base(organizationId)}/operations/${operationId}/policy-bindings`, body, opts);
  }
  updatePolicyBinding(organizationId: string, operationId: string, bindingId: string, body: UpdatePolicyBindingRequest, opts?: CallOptions) {
    return this.send<OperationPolicyBinding>('PATCH', `${this.base(organizationId)}/operations/${operationId}/policy-bindings/${bindingId}`, body, opts);
  }
  deletePolicyBinding(organizationId: string, operationId: string, bindingId: string, opts?: CallOptions) {
    return this.send<OperationPolicyBinding>('DELETE', `${this.base(organizationId)}/operations/${operationId}/policy-bindings/${bindingId}`, undefined, opts);
  }

  // ── Aprovações (ARDEN-BE-004) ────────────────────────────────────────────────
  listApprovalFlows(organizationId: string, q: CursorPageQuery, opts?: CallOptions) {
    return this.list<ApprovalFlow>(`${this.base(organizationId)}/approval-flows${query(q as Record<string, unknown>)}`, opts);
  }
  getApprovalFlow(organizationId: string, flowId: string, opts?: CallOptions) {
    return this.get<ApprovalFlow>(`${this.base(organizationId)}/approval-flows/${flowId}`, opts);
  }
  createApprovalFlow(organizationId: string, body: CreateApprovalFlowRequest, opts: CallOptions & { idempotencyKey: string }) {
    return this.send<ApprovalFlow>('POST', `${this.base(organizationId)}/approval-flows`, body, opts);
  }
  updateApprovalFlow(organizationId: string, flowId: string, body: UpdateApprovalFlowRequest, opts?: CallOptions) {
    return this.send<ApprovalFlow>('PATCH', `${this.base(organizationId)}/approval-flows/${flowId}`, body, opts);
  }
  activateApprovalFlow(organizationId: string, flowId: string, body: ApprovalFlowTransitionRequest, opts: CallOptions & { idempotencyKey: string }) {
    return this.send<ApprovalFlow>('POST', `${this.base(organizationId)}/approval-flows/${flowId}/activate`, body, opts);
  }
  suspendApprovalFlow(organizationId: string, flowId: string, body: ApprovalFlowTransitionRequest, opts: CallOptions & { idempotencyKey: string }) {
    return this.send<ApprovalFlow>('POST', `${this.base(organizationId)}/approval-flows/${flowId}/suspend`, body, opts);
  }
  listApprovalRequests(organizationId: string, q: ListApprovalRequestsQuery, opts?: CallOptions) {
    return this.list<ApprovalRequest>(`${this.base(organizationId)}/approval-requests${query(q)}`, opts);
  }
  getApprovalRequest(organizationId: string, requestId: string, opts?: CallOptions) {
    return this.get<ApprovalRequest>(`${this.base(organizationId)}/approval-requests/${requestId}`, opts);
  }
  createApprovalRequest(organizationId: string, operationId: string, body: CreateApprovalRequestRequest, opts: CallOptions & { idempotencyKey: string }) {
    return this.send<ApprovalRequest>('POST', `${this.base(organizationId)}/operations/${operationId}/approval-requests`, body, opts);
  }
  approveApprovalRequest(organizationId: string, requestId: string, body: DecideApprovalRequest, opts?: CallOptions) {
    return this.send<ApprovalDecisionResult>('POST', `${this.base(organizationId)}/approval-requests/${requestId}/approve`, body, opts);
  }
  rejectApprovalRequest(organizationId: string, requestId: string, body: DecideApprovalRequest, opts?: CallOptions) {
    return this.send<ApprovalRequest>('POST', `${this.base(organizationId)}/approval-requests/${requestId}/reject`, body, opts);
  }
  cancelApprovalRequest(organizationId: string, requestId: string, body: CancelApprovalRequest, opts?: CallOptions) {
    return this.send<ApprovalRequest>('POST', `${this.base(organizationId)}/approval-requests/${requestId}/cancel`, body, opts);
  }
  listApprovalDelegations(organizationId: string, opts?: CallOptions) {
    return this.get<ApprovalDelegation[]>(`${this.base(organizationId)}/approval-delegations`, opts);
  }
  createApprovalDelegation(organizationId: string, body: CreateApprovalDelegationRequest, opts: CallOptions & { idempotencyKey: string }) {
    return this.send<ApprovalDelegation>('POST', `${this.base(organizationId)}/approval-delegations`, body, opts);
  }
  revokeApprovalDelegation(organizationId: string, delegationId: string, body: RevokeApprovalDelegationRequest, opts: CallOptions & { idempotencyKey: string }) {
    return this.send<ApprovalDelegation>('POST', `${this.base(organizationId)}/approval-delegations/${delegationId}/revoke`, body, opts);
  }

  // ── Enforcement de autoridade (ARDEN-BE-004) ─────────────────────────────────
  evaluateAction(organizationId: string, operationId: string, body: EvaluateActionRequest, opts?: CallOptions) {
    return this.send<ActionEvaluationResult>('POST', `${this.base(organizationId)}/operations/${operationId}/actions/evaluate`, body, opts);
  }
  validateAuthorization(organizationId: string, body: ValidateAuthorizationRequest, opts?: CallOptions) {
    return this.send<ActionValidationResult>('POST', `${this.base(organizationId)}/action-authorizations/validate`, body, opts);
  }

  // ── Execução (ARDEN-BE-005) ──────────────────────────────────────────────────
  listExecutions(organizationId: string, q: ListExecutionsQuery, opts?: CallOptions) {
    return this.list<ExecutionRun>(`${this.base(organizationId)}/executions${query(q as Record<string, unknown>)}`, opts);
  }
  createExecution(organizationId: string, operationId: string, body: CreateExecutionRequest, opts: CallOptions & { idempotencyKey: string }) {
    return this.send<ExecutionRun>('POST', `${this.base(organizationId)}/operations/${operationId}/executions`, body, opts);
  }
  getExecution(organizationId: string, executionId: string, opts?: CallOptions) {
    return this.get<ExecutionRun>(`${this.base(organizationId)}/executions/${executionId}`, opts);
  }
  pauseExecution(organizationId: string, executionId: string, body: ExecutionCommandRequest, opts?: CallOptions) {
    return this.send<ExecutionRun>('POST', `${this.base(organizationId)}/executions/${executionId}/pause`, body, opts);
  }
  resumeExecution(organizationId: string, executionId: string, body: ExecutionCommandRequest, opts?: CallOptions) {
    return this.send<ExecutionRun>('POST', `${this.base(organizationId)}/executions/${executionId}/resume`, body, opts);
  }
  cancelExecution(organizationId: string, executionId: string, body: ExecutionCommandRequest, opts?: CallOptions) {
    return this.send<ExecutionRun>('POST', `${this.base(organizationId)}/executions/${executionId}/cancel`, body, opts);
  }
  retryExecution(organizationId: string, executionId: string, body: ExecutionCommandRequest, opts?: CallOptions) {
    return this.send<ExecutionRun>('POST', `${this.base(organizationId)}/executions/${executionId}/retry`, body, opts);
  }
  listExecutionSteps(organizationId: string, executionId: string, opts?: CallOptions) {
    return this.get<ExecutionStep[]>(`${this.base(organizationId)}/executions/${executionId}/steps`, opts);
  }
  getExecutionStep(organizationId: string, executionId: string, stepId: string, opts?: CallOptions) {
    return this.get<ExecutionStep>(`${this.base(organizationId)}/executions/${executionId}/steps/${stepId}`, opts);
  }
  listExecutionEvents(organizationId: string, executionId: string, q: ListExecutionEventsQuery, opts?: CallOptions) {
    return this.list<ExecutionEvent>(`${this.base(organizationId)}/executions/${executionId}/events${query(q as Record<string, unknown>)}`, opts);
  }
  listExecutionEvidence(organizationId: string, executionId: string, opts?: CallOptions) {
    return this.get<EvidenceRecord[]>(`${this.base(organizationId)}/executions/${executionId}/evidence`, opts);
  }
  getExecutionEvidence(organizationId: string, executionId: string, evidenceId: string, opts?: CallOptions) {
    return this.get<EvidenceRecord>(`${this.base(organizationId)}/executions/${executionId}/evidence/${evidenceId}`, opts);
  }

  // ── Conectores: catálogo (público, não tenant-scoped) (ARDEN-BE-006) ─────────
  listConnectors(opts?: CallOptions) {
    return this.get<ConnectorDefinition[]>('/connectors', opts);
  }
  getConnector(connectorKey: string, opts?: CallOptions) {
    return this.get<ConnectorDefinition>(`/connectors/${connectorKey}`, opts);
  }
  listConnectorTools(connectorKey: string, opts?: CallOptions) {
    return this.get<ConnectorToolDefinition[]>(`/connectors/${connectorKey}/tools`, opts);
  }

  // ── Conexões ─────────────────────────────────────────────────────────────────
  listConnections(organizationId: string, q: ListConnectionsQuery, opts?: CallOptions) {
    return this.list<Connection>(`${this.base(organizationId)}/connections${query(q as Record<string, unknown>)}`, opts);
  }
  createConnection(organizationId: string, body: CreateConnectionRequest, opts: CallOptions & { idempotencyKey: string }) {
    return this.send<Connection>('POST', `${this.base(organizationId)}/connections`, body, opts);
  }
  getConnection(organizationId: string, connectionId: string, opts?: CallOptions) {
    return this.get<Connection>(`${this.base(organizationId)}/connections/${connectionId}`, opts);
  }
  updateConnection(organizationId: string, connectionId: string, body: UpdateConnectionRequest, opts?: CallOptions) {
    return this.send<Connection>('PATCH', `${this.base(organizationId)}/connections/${connectionId}`, body, opts);
  }
  testConnection(organizationId: string, connectionId: string, body: TestConnectionRequest, opts: CallOptions & { idempotencyKey: string }) {
    return this.send<TestConnectionResult>('POST', `${this.base(organizationId)}/connections/${connectionId}/test`, body, opts);
  }
  activateConnection(organizationId: string, connectionId: string, body: ConnectionCommandRequest, opts: CallOptions & { idempotencyKey: string }) {
    return this.send<Connection>('POST', `${this.base(organizationId)}/connections/${connectionId}/activate`, body, opts);
  }
  suspendConnection(organizationId: string, connectionId: string, body: ConnectionCommandRequest, opts: CallOptions & { idempotencyKey: string }) {
    return this.send<Connection>('POST', `${this.base(organizationId)}/connections/${connectionId}/suspend`, body, opts);
  }
  reactivateConnection(organizationId: string, connectionId: string, body: ConnectionCommandRequest, opts: CallOptions & { idempotencyKey: string }) {
    return this.send<Connection>('POST', `${this.base(organizationId)}/connections/${connectionId}/reactivate`, body, opts);
  }
  revokeConnection(organizationId: string, connectionId: string, body: ConnectionCommandRequest, opts: CallOptions & { idempotencyKey: string }) {
    return this.send<Connection>('POST', `${this.base(organizationId)}/connections/${connectionId}/revoke`, body, opts);
  }

  // ── Credenciais ──────────────────────────────────────────────────────────────
  listCredentials(organizationId: string, connectionId: string, opts?: CallOptions) {
    return this.list<CredentialMetadata>(`${this.base(organizationId)}/connections/${connectionId}/credentials`, opts);
  }
  createCredential(organizationId: string, connectionId: string, body: CreateConnectionCredentialRequest, opts: CallOptions & { idempotencyKey: string }) {
    return this.send<CredentialMetadata>('POST', `${this.base(organizationId)}/connections/${connectionId}/credentials`, body, opts);
  }
  rotateCredential(organizationId: string, connectionId: string, body: RotateConnectionCredentialRequest, opts: CallOptions & { idempotencyKey: string }) {
    return this.send<CredentialMetadata>('POST', `${this.base(organizationId)}/connections/${connectionId}/credentials/rotate`, body, opts);
  }
  revokeCredential(organizationId: string, connectionId: string, credentialVersionId: string, opts: CallOptions & { idempotencyKey: string }) {
    return this.send<CredentialMetadata>('POST', `${this.base(organizationId)}/connections/${connectionId}/credentials/${credentialVersionId}/revoke`, undefined, opts);
  }

  // ── Tool bindings ────────────────────────────────────────────────────────────
  listToolBindings(organizationId: string, q: ListToolBindingsQuery, opts?: CallOptions) {
    return this.list<OrganizationToolBinding>(`${this.base(organizationId)}/tool-bindings${query(q as Record<string, unknown>)}`, opts);
  }
  createToolBinding(organizationId: string, body: CreateOrganizationToolBindingRequest, opts: CallOptions & { idempotencyKey: string }) {
    return this.send<OrganizationToolBinding>('POST', `${this.base(organizationId)}/tool-bindings`, body, opts);
  }
  getToolBinding(organizationId: string, bindingId: string, opts?: CallOptions) {
    return this.get<OrganizationToolBinding>(`${this.base(organizationId)}/tool-bindings/${bindingId}`, opts);
  }
  updateToolBinding(organizationId: string, bindingId: string, body: UpdateOrganizationToolBindingRequest, opts?: CallOptions) {
    return this.send<OrganizationToolBinding>('PATCH', `${this.base(organizationId)}/tool-bindings/${bindingId}`, body, opts);
  }
  disableToolBinding(organizationId: string, bindingId: string, body: ConnectionCommandRequest, opts: CallOptions & { idempotencyKey: string }) {
    return this.send<OrganizationToolBinding>('POST', `${this.base(organizationId)}/tool-bindings/${bindingId}/disable`, body, opts);
  }

  // ── Operation bindings ───────────────────────────────────────────────────────
  listOperationToolBindings(organizationId: string, operationId: string, opts?: CallOptions) {
    return this.get<OperationToolBinding[]>(`${this.base(organizationId)}/operations/${operationId}/tool-bindings`, opts);
  }
  createOperationToolBinding(organizationId: string, operationId: string, body: CreateOperationToolBindingRequest, opts: CallOptions & { idempotencyKey: string }) {
    return this.send<OperationToolBinding>('POST', `${this.base(organizationId)}/operations/${operationId}/tool-bindings`, body, opts);
  }
  updateOperationToolBinding(organizationId: string, operationId: string, bindingId: string, body: UpdateOperationToolBindingRequest, opts?: CallOptions) {
    return this.send<OperationToolBinding>('PATCH', `${this.base(organizationId)}/operations/${operationId}/tool-bindings/${bindingId}`, body, opts);
  }
  removeOperationToolBinding(organizationId: string, operationId: string, bindingId: string, opts?: CallOptions) {
    return this.send<OperationToolBinding>('DELETE', `${this.base(organizationId)}/operations/${operationId}/tool-bindings/${bindingId}`, undefined, opts);
  }

  // ── Webhooks ─────────────────────────────────────────────────────────────────
  listWebhookEndpoints(organizationId: string, q: ListWebhookEndpointsQuery, opts?: CallOptions) {
    return this.list<WebhookEndpoint>(`${this.base(organizationId)}/webhook-endpoints${query(q as Record<string, unknown>)}`, opts);
  }
  createWebhookEndpoint(organizationId: string, body: CreateWebhookEndpointRequest, opts: CallOptions & { idempotencyKey: string }) {
    return this.send<WebhookEndpointSecret>('POST', `${this.base(organizationId)}/webhook-endpoints`, body, opts);
  }
  getWebhookEndpoint(organizationId: string, webhookEndpointId: string, opts?: CallOptions) {
    return this.get<WebhookEndpoint>(`${this.base(organizationId)}/webhook-endpoints/${webhookEndpointId}`, opts);
  }
  updateWebhookEndpoint(organizationId: string, webhookEndpointId: string, body: UpdateWebhookEndpointRequest, opts?: CallOptions) {
    return this.send<WebhookEndpoint>('PATCH', `${this.base(organizationId)}/webhook-endpoints/${webhookEndpointId}`, body, opts);
  }
  suspendWebhookEndpoint(organizationId: string, webhookEndpointId: string, body: WebhookCommandRequest, opts: CallOptions & { idempotencyKey: string }) {
    return this.send<WebhookEndpoint>('POST', `${this.base(organizationId)}/webhook-endpoints/${webhookEndpointId}/suspend`, body, opts);
  }
  reactivateWebhookEndpoint(organizationId: string, webhookEndpointId: string, body: WebhookCommandRequest, opts: CallOptions & { idempotencyKey: string }) {
    return this.send<WebhookEndpoint>('POST', `${this.base(organizationId)}/webhook-endpoints/${webhookEndpointId}/reactivate`, body, opts);
  }
  revokeWebhookEndpoint(organizationId: string, webhookEndpointId: string, body: WebhookCommandRequest, opts: CallOptions & { idempotencyKey: string }) {
    return this.send<WebhookEndpoint>('POST', `${this.base(organizationId)}/webhook-endpoints/${webhookEndpointId}/revoke`, body, opts);
  }
}
