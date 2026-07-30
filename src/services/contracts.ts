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

export interface OperationQuery {
  organizationId?: string;
  status?: string;
  search?: string;
  page?: number;
  pageSize?: number;
  signal?: AbortSignal;
}

/** Contrato de exemplo do handoff. Todo método aceita AbortSignal opcional. */
export interface OperationsRepository {
  list(params?: OperationQuery): Promise<PaginatedResult<Operation>>;
  getById(id: string, signal?: AbortSignal): Promise<Operation>;
  create(input: Operation): Promise<Operation>;
  update(id: string, input: Partial<Operation>): Promise<Operation>;
  publish(id: string): Promise<Operation>;
  pause(id: string): Promise<Operation>;
  resume(id: string): Promise<Operation>;
  createExecution(id: string, opts?: { test: boolean }): Promise<Execution>;
  archive(id: string): Promise<void>;
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
