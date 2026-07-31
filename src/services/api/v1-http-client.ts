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
} from '@/contracts';
import type { ArdenApiV1Client, ClientPage, CallOptions } from './generated/api-v1-client';

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
}
