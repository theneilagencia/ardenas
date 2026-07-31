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
} from '@/contracts';

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
}
