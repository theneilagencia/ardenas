/**
 * Arden.AS — modelo de domínio.
 * Toda entidade aqui existe na demonstração e tem tela correspondente.
 * Extraído de docs/handoff/DOMAIN_MODEL.md.
 */

export type ID = string;
export type ISODate = string;

// ── Hierarquia organizacional ──────────────────────────────────────────────

export interface Organization {
  id: ID;
  name: string;
  companyIds: ID[];
}

export interface Company {
  id: ID;
  organizationId: ID;
  name: string;
  cnpj: string;
}

export interface Unit {
  id: ID;
  organizationId: ID;
  companyId: ID;
  name: string;
  region?: string;
}

export interface Area {
  id: ID;
  organizationId: ID;
  companyId: ID;
  unitId: ID;
  name: string;
}

export interface Team {
  id: ID;
  areaId: ID;
  name: string;
  managerId: ID;
  approverIds: ID[];
}

export interface CostCenter {
  id: ID;
  areaId: ID;
  name: string;
  code: string;
}

// ── Pessoas e papéis ────────────────────────────────────────────────────────

export type RoleKey =
  | 'corporate_admin'
  | 'financial_admin'
  | 'operation_owner'
  | 'supervisor'
  | 'approver'
  | 'security_admin'
  | 'analyst'
  | 'auditor';

export interface Role {
  id: ID;
  key: RoleKey;
  name: string;
}

export type PersonStatus = 'active' | 'suspended' | 'invited';

export interface Person {
  id: ID;
  organizationId: ID;
  companyId?: ID;
  name: string;
  email: string;
  roleKeys: RoleKey[];
  status: PersonStatus;
}

// ── Gradientes de Autoridade ─────────────────────────────────────────────────

export type AuthorityLevel =
  | 'observe'
  | 'prepare'
  | 'execute_under_rule'
  | 'execute_with_approval'
  | 'blocked';

export const AUTHORITY_ORDER: AuthorityLevel[] = [
  'observe',
  'prepare',
  'execute_under_rule',
  'execute_with_approval',
  'blocked',
];

// ── Operação ─────────────────────────────────────────────────────────────────

export type Criticality = 'low' | 'moderate' | 'elevated' | 'critical';
export type Environment = 'sandbox' | 'staging' | 'production';

export type OperationStatus =
  | 'draft'
  | 'awaiting_approval'
  | 'scheduled'
  | 'running'
  | 'paused'
  | 'archived';

export interface OperationStep {
  id: ID;
  order: number;
  name: string;
  description: string;
  authorityLevel: AuthorityLevel;
  requiresApproval: boolean;
  workUnitCost: number;
  producesEvidence: boolean;
}

export interface OperationAction {
  id: ID;
  name: string;
  authorityLevel: AuthorityLevel;
  destructive: boolean;
}

export interface OperationalLimit {
  id: ID;
  kind: 'rate' | 'volume' | 'cost' | 'window';
  label: string;
  value: number;
  unit: string;
}

export interface Operation {
  id: ID;
  // Identidade
  name: string;
  organizationId: ID;
  companyId: ID;
  unitId: ID;
  areaId: ID;
  costCenterId: ID;
  criticality: Criticality;
  tags: string[];
  // Resultado
  problem: string;
  objective: string;
  expectedResult: string;
  recipients: ID[];
  deliverables: string[];
  frequency: string;
  sla: string;
  indicators: Indicator[];
  completionCriteria: string[];
  // Responsáveis
  ownerId: ID;
  businessOwnerId?: ID;
  technicalOwnerId?: ID;
  supervisorId?: ID;
  approverIds: ID[];
  substituteIds: ID[];
  // Execução
  triggers: string[];
  contextSourceIds: ID[];
  integrationIds: ID[];
  steps: OperationStep[];
  actions: OperationAction[];
  // Controle
  approvalChain: ID[];
  operationalLimits: OperationalLimit[];
  budget: number;
  workUnits: number;
  evidencePolicy: string;
  retentionPolicy: string;
  notificationRules: string[];
  // Ciclo
  environment: Environment | null;
  version: string;
  status: OperationStatus;
  publishedAt: ISODate | null;
  createdAt: ISODate;
  updatedAt: ISODate;
}

export interface Indicator {
  id: ID;
  name: string;
  target: number;
  current: number;
  unit: string;
}

// ── Execução ─────────────────────────────────────────────────────────────────

export type ExecutionState =
  | 'preparing'
  | 'running'
  | 'awaiting_approval'
  | 'paused'
  | 'exception'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface ExecutionStepResult {
  stepId: ID;
  stepName: string;
  state: 'pending' | 'running' | 'awaiting_approval' | 'completed' | 'failed';
  evidenceId?: ID;
  workUnitsUsed: number;
  startedAt?: ISODate;
  finishedAt?: ISODate;
}

export interface Execution {
  id: ID;
  organizationId: ID;
  operationId: ID;
  operationVersion: string;
  test: boolean;
  state: ExecutionState;
  steps: ExecutionStepResult[];
  workUnitsUsed: number;
  budgetDebited: number;
  startedAt: ISODate;
  finishedAt?: ISODate;
}

// ── Aprovação e Exceção ──────────────────────────────────────────────────────

export type ApprovalState = 'pending' | 'approved' | 'rejected' | 'changes_requested' | 'delegated';

export interface Approval {
  id: ID;
  organizationId: ID;
  operationId: ID;
  executionId?: ID;
  stepId?: ID;
  state: ApprovalState;
  requestedAt: ISODate;
  resolvedAt?: ISODate;
  resolverId?: ID;
  approverIds: ID[];
  justification?: string;
  // Detalhe apresentado no painel de decisão
  title?: string;
  operationLabel?: string;
  category?: string;
  criticality?: Criticality;
  proposedAction?: string;
  recipients?: string;
  authorityLevel?: AuthorityLevel;
  requestedBy?: string;
  due?: string;
  impact?: string;
  content?: string;
  evidenceLabels?: string[];
}

export type ExceptionState = 'open' | 'resolved' | 'reprocessing';

export interface OperationException {
  id: ID;
  organizationId: ID;
  operationId: ID;
  executionId?: ID;
  state: ExceptionState;
  reason: string;
  openedAt: ISODate;
}

// ── Evidência ─────────────────────────────────────────────────────────────────

export type EvidenceType =
  | 'source'
  | 'document'
  | 'record'
  | 'version'
  | 'decision'
  | 'approval'
  | 'action'
  | 'message'
  | 'result'
  | 'log'
  | 'exception'
  | 'justification';

export interface Evidence {
  id: ID;
  organizationId: ID;
  type: EvidenceType;
  label: string;
  operationId?: ID;
  executionId?: ID;
  createdAt: ISODate;
}

// ── Política ─────────────────────────────────────────────────────────────────

export type PolicyState = 'draft' | 'submitted' | 'approved' | 'published' | 'suspended';
export type PolicyLevel = 'corporate' | 'company' | 'area' | 'local_exception';

export interface Policy {
  id: ID;
  organizationId: ID;
  companyId?: ID;
  areaId?: ID;
  level: PolicyLevel;
  name: string;
  state: PolicyState;
  justification?: string;
  expiresAt?: ISODate;
  // Metadados exibidos na Governança
  scopeLabel?: string;
  ownerName?: string;
  version?: string;
  opsCount?: number;
  updatedAt?: ISODate;
}

// ── Risco ─────────────────────────────────────────────────────────────────────

export type RiskLevel = 'low' | 'moderate' | 'elevated' | 'critical';
export type Reversibility = 'reversible' | 'partial' | 'irreversible';

export interface Risk {
  id: ID;
  organizationId: ID;
  operationId: ID;
  actionId: ID;
  actionName: string;
  dataAccessed: string;
  integrationId?: ID;
  consequence: string;
  reversibility: Reversibility;
  exposure: string;
  impact: RiskLevel;
  authorityLevel: AuthorityLevel;
  approvalRequired: boolean;
  ownerId: ID;
  mitigation: string;
}

// ── Integração e contexto ─────────────────────────────────────────────────────

export type IntegrationStatus = 'disconnected' | 'connected' | 'error' | 'expired';

export interface Integration {
  id: ID;
  organizationId: ID;
  name: string;
  kind: string;
  status: IntegrationStatus;
  lastTestedAt?: ISODate;
}

export interface ContextSource {
  id: ID;
  organizationId: ID;
  name: string;
  kind: string;
  version: number;
}

// ── Arquivos e quarentena ────────────────────────────────────────────────────

export type FileState = 'active' | 'quarantined' | 'deletion_requested' | 'deleted';

export interface ManagedFile {
  id: ID;
  organizationId: ID;
  name: string;
  repository: string;
  sizeBytes: number;
  ageDays: number;
  criterion: string;
  linkedOperationId?: ID;
  critical: boolean;
  state: FileState;
  quarantinedAt?: ISODate;
  recoverableUntil?: ISODate;
  deletionApprovers: ID[];
}

// ── Work Units e orçamento ────────────────────────────────────────────────────

export interface WorkUnitLedger {
  id: ID;
  organizationId: ID;
  areaId: ID;
  contracted: number;
  used: number;
  reserved: number;
  projected: number;
  available: number;
  overage: number;
}

export interface Budget {
  id: ID;
  organizationId: ID;
  areaId: ID;
  costCenterId: ID;
  total: number;
  spent: number;
}

export type WorkUnitRequestState = 'pending' | 'approved' | 'rejected';

export interface WorkUnitRequest {
  id: ID;
  organizationId: ID;
  areaId: ID;
  amount: number;
  justification: string;
  state: WorkUnitRequestState;
}

// ── Auditoria ─────────────────────────────────────────────────────────────────

export interface AuditEvent {
  id: ID;
  timestamp: ISODate;
  actorId: ID;
  actorRole: RoleKey;
  organizationId: ID;
  action: string;
  objectType: string;
  objectId: ID;
  previousValue: unknown;
  newValue: unknown;
  justification?: string;
  relatedOperationId?: ID;
  relatedExecutionId?: ID;
  evidenceId?: ID;
  result: 'success' | 'denied' | 'error';
}

// ── Implantação corporativa (onboarding) ─────────────────────────────────────

export interface DeploymentStep {
  id: ID;
  order: number;
  name: string;
  description: string;
  ownerId: ID;
  ownerName: string;
  help: string;
  expectedResult: string;
  done: boolean;
  completedAt?: ISODate;
}

export interface Deployment {
  id: ID;
  organizationId: ID;
  name: string;
  steps: DeploymentStep[];
  completed: boolean;
  completedAt?: ISODate;
}

// ── Resultados (portfólio de indicadores) ────────────────────────────────────

export type ResultMethod = 'measured' | 'estimated' | 'client_reported' | 'validated' | 'unavailable';

export interface ResultIndicator {
  id: ID;
  organizationId: ID;
  name: string;
  method: ResultMethod;
  value: string;
  delta: string;
  before: string;
}

// ── Matriz de Gradientes de Autoridade ────────────────────────────────────────

export interface AuthorityMatrixRow {
  id: ID;
  organizationId: ID;
  action: string;
  system: string;
  condition: string;
  reversible: boolean;
  risk: RiskLevel;
  authorityLevel: AuthorityLevel;
}

// ── Assessment (Autonomous Work Assessment) ───────────────────────────────────

export type AssessmentStage = 'analyzing' | 'awaiting_info' | 'completed';

export interface Assessment {
  id: ID;
  organizationId: ID;
  operationName: string;
  discipline: string;
  date: string;
  company: string;
  responsibleId: ID;
  responsibleName: string;
  stage: AssessmentStage;
  recommendation: string;
  execScore: number;
  workUnitsRange: string;
}

// ── Notificações ──────────────────────────────────────────────────────────────

export interface AppNotification {
  id: ID;
  organizationId: ID;
  title: string;
  body: string;
  read: boolean;
  createdAt: ISODate;
}
