/**
 * Arden.AS — store global.
 * Fonte da verdade em memória, hidratada do provider e persistida a cada
 * mutação. Toda alteração de estado grava evento de auditoria.
 */

import { create } from 'zustand';
import type { DomainSnapshot } from '@/services/contracts';
import {
  getServices,
  getSnapshotStore,
  resolveProviderKind,
} from '@/services/service-container';
import { permissionsFor, type Session } from '@/domain/permissions';
import type {
  ApprovalState,
  AuditEvent,
  Deployment,
  Evidence,
  Execution,
  ExecutionStepResult,
  Operation,
  Person,
  Policy,
  PolicyLevel,
  RoleKey,
} from '@/domain/types';
import { newId, now } from '@/lib/id';

export type Theme = 'light' | 'dark';

interface RecordAuditInput {
  action: string;
  objectType: string;
  objectId: string;
  previousValue?: unknown;
  newValue?: unknown;
  justification?: string;
  relatedOperationId?: string;
  relatedExecutionId?: string;
  evidenceId?: string;
  result?: AuditEvent['result'];
}

const emptySnapshot: DomainSnapshot = {
  organizations: [],
  companies: [],
  units: [],
  areas: [],
  teams: [],
  costCenters: [],
  people: [],
  roles: [],
  operations: [],
  executions: [],
  approvals: [],
  exceptions: [],
  evidence: [],
  policies: [],
  risks: [],
  integrations: [],
  contextSources: [],
  files: [],
  workUnits: [],
  budgets: [],
  workUnitRequests: [],
  auditEvents: [],
  deployments: [],
  notifications: [],
  resultIndicators: [],
  authorityMatrix: [],
  assessments: [],
};

export interface AppState {
  ready: boolean;
  data: DomainSnapshot;
  session: Session | null;
  organizationId: string;
  theme: Theme;

  // UI
  drawerOpen: boolean;
  assistantOpen: boolean;
  cmdOpen: boolean;
  tourStep: number; // -1 = fechado
  /** Contador incremental: bump a cada evento de auditoria gravado, para revalidar leituras. */
  auditVersion: number;

  // lifecycle
  bootstrap: () => Promise<void>;
  resetDemo: () => Promise<void>;

  // session / theme / org
  switchProfile: (role: RoleKey) => void;
  switchOrganization: (organizationId: string) => void;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  setDrawerOpen: (open: boolean) => void;
  setAssistantOpen: (open: boolean) => void;
  setCmdOpen: (open: boolean) => void;
  startTour: () => void;
  tourNext: () => void;
  tourPrev: () => void;
  endTour: () => void;

  // audit
  recordAudit: (input: RecordAuditInput) => AuditEvent;

  // execuções (agregado ainda na store; recebe a Operação já carregada via repositório)
  startExecution: (operation: Operation, opts?: { test: boolean }) => Execution;

  // approvals
  resolveApproval: (id: string, decision: ApprovalState, justification?: string) => void;

  // deployment
  completeDeploymentStep: (deploymentId: string, stepId: string) => void;
  redoDeploymentStep: (deploymentId: string, stepId: string) => void;

  // files
  quarantineFile: (id: string) => void;
  restoreFile: (id: string) => void;
  requestFileDeletion: (id: string, approverId: string) => void;
  approveFileDeletion: (id: string, approverId: string) => void;

  // people (ações administrativas gravando na store)
  invitePerson: (input: { name: string; email: string; roleKeys: RoleKey[] }) => Person;
  updatePersonRoles: (id: string, roleKeys: RoleKey[]) => void;
  suspendPerson: (id: string) => void;
  reactivatePerson: (id: string) => void;

  // policies
  createPolicy: (input: { name: string; level: PolicyLevel }) => Policy;
  submitPolicy: (id: string) => void;
  publishPolicy: (id: string) => void;
  suspendPolicy: (id: string) => void;

  // integrations
  connectIntegration: (id: string) => void;
  testIntegration: (id: string) => void;
  disconnectIntegration: (id: string) => void;

  // context
  addContextSource: (input: { name: string; kind: string }) => void;
  versionContextSource: (id: string) => void;

  // work units / budget
  requestWorkUnits: (input: { areaId: string; amount: number; justification: string }) => void;
  approveWorkUnitRequest: (id: string) => void;
  setBudget: (id: string, total: number) => void;

  // environments

  // exceptions
  resolveException: (id: string) => void;
  reprocessException: (id: string) => void;

  // reports
  exportReport: (reportId: string) => void;

  // notifications
  markNotificationsRead: () => void;
}

function currentActor(session: Session | null): { id: string; role: RoleKey } {
  if (!session) return { id: 'system', role: 'corporate_admin' };
  return { id: session.person.id, role: session.roleKeys[0] ?? 'analyst' };
}

export const useAppStore = create<AppState>((set, get) => {
  /**
   * Persistência *slice-aware*: as fatias já migradas para repositórios
   * (operations, auditEvents) são mantidas a partir do snapshot corrente e nunca
   * sobrescritas pela store — evita dupla fonte de verdade. A store persiste
   * apenas as fatias que ainda gerencia (fases 2–4).
   */
  const persist = async (): Promise<void> => {
    if (resolveProviderKind() === 'api') return; // modo api: mutações vão por repositório
    const data = get().data;
    await getSnapshotStore().update((cur) => ({
      ...data,
      operations: cur.operations,
      auditEvents: cur.auditEvents,
    }));
  };

  const applyTheme = (theme: Theme) => {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', theme);
    }
  };

  return {
    ready: false,
    data: emptySnapshot,
    session: null,
    organizationId: '',
    theme: 'light',
    drawerOpen: false,
    assistantOpen: false,
    cmdOpen: false,
    tourStep: -1,
    auditVersion: 0,

    bootstrap: async () => {
      const kind = resolveProviderKind();
      const data = kind === 'api' ? emptySnapshot : await getSnapshotStore().read();
      const firstOrg = data.organizations[0]?.id ?? '';
      const admin = data.people.find((p) => p.roleKeys.includes('corporate_admin'));
      const session: Session | null = admin
        ? {
            person: admin,
            organizationId: firstOrg,
            roleKeys: admin.roleKeys,
            permissions: permissionsFor(admin.roleKeys),
          }
        : null;
      set({ ready: true, data, organizationId: firstOrg, session });
    },

    resetDemo: async () => {
      if (resolveProviderKind() !== 'api') await getSnapshotStore().clear();
      set({ ready: false });
      await get().bootstrap();
    },

    switchProfile: (role) => {
      const { data, organizationId } = get();
      const person = data.people.find(
        (p) => p.roleKeys.includes(role) && p.organizationId === organizationId,
      );
      if (!person) return;
      set({
        session: {
          person,
          organizationId,
          roleKeys: person.roleKeys,
          permissions: permissionsFor(person.roleKeys),
        },
      });
    },

    switchOrganization: (organizationId) => {
      const { session } = get();
      set({
        organizationId,
        session: session ? { ...session, organizationId } : session,
      });
    },

    setTheme: (theme) => {
      applyTheme(theme);
      set({ theme });
    },

    toggleTheme: () => {
      const next: Theme = get().theme === 'light' ? 'dark' : 'light';
      applyTheme(next);
      set({ theme: next });
    },

    setDrawerOpen: (open) => set({ drawerOpen: open }),
    setAssistantOpen: (open) => set({ assistantOpen: open }),
    setCmdOpen: (open) => set({ cmdOpen: open }),
    startTour: () => set({ tourStep: 0 }),
    tourNext: () => set((s) => ({ tourStep: s.tourStep + 1 })),
    tourPrev: () => set((s) => ({ tourStep: Math.max(0, s.tourStep - 1) })),
    endTour: () => set({ tourStep: -1 }),

    recordAudit: (input) => {
      const { session, organizationId } = get();
      const actor = currentActor(session);
      const event: AuditEvent = {
        id: newId('aud'),
        timestamp: now(),
        actorId: actor.id,
        actorRole: actor.role,
        organizationId,
        action: input.action,
        objectType: input.objectType,
        objectId: input.objectId,
        previousValue: input.previousValue ?? null,
        newValue: input.newValue ?? null,
        justification: input.justification,
        relatedOperationId: input.relatedOperationId,
        relatedExecutionId: input.relatedExecutionId,
        evidenceId: input.evidenceId,
        result: input.result ?? 'success',
      };
      // Fronteira única de auditoria: grava pelo repositório (fonte da verdade dos
      // eventos) e só então persiste as fatias que a store ainda gerencia.
      void getServices()
        .audit.append(event)
        .then(() => persist())
        .then(() => set((s) => ({ auditVersion: s.auditVersion + 1 })))
        .catch(() => {});
      return event;
    },

    startExecution: (operation, opts) => {
      // A Operação chega já carregada via repositório (a store não é mais fonte
      // da verdade de operations). Executions permanece na store (Fase futura).
      const op = operation;
      const test = opts?.test ?? false;

      // 1-2. Cria objeto em executions, vincula à operação e à versão publicada.
      const execId = newId('exec');
      const newEvidence: Evidence[] = [];
      let awaiting = false;
      let workUnitsUsed = 0;

      // 3. Percorre as steps[] configuradas na operação, não uma sequência genérica.
      const steps: ExecutionStepResult[] = op.steps
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((step) => {
          // 4. Gera evidência por etapa.
          const ev: Evidence = {
            id: newId('ev'),
            organizationId: op.organizationId,
            type: 'result',
            label: `Evidência — ${step.name}`,
            operationId: op.id,
            executionId: execId,
            createdAt: now(),
          };
          newEvidence.push(ev);
          // 5. Registra consumo de Work Units.
          workUnitsUsed += step.workUnitCost;
          // 6. Cria Approval quando a etapa tem execute_with_approval.
          const needsApproval = step.requiresApproval || step.authorityLevel === 'execute_with_approval';
          if (needsApproval) awaiting = true;
          return {
            stepId: step.id,
            stepName: step.name,
            state: needsApproval ? 'awaiting_approval' : 'completed',
            evidenceId: ev.id,
            workUnitsUsed: step.workUnitCost,
            startedAt: now(),
            finishedAt: now(),
          };
        });

      const budgetDebited = workUnitsUsed * 20; // custo indicativo por WU
      const execution: Execution = {
        id: execId,
        organizationId: op.organizationId,
        operationId: op.id,
        operationVersion: op.version,
        test,
        state: awaiting ? 'awaiting_approval' : 'completed',
        steps,
        workUnitsUsed,
        budgetDebited,
        startedAt: now(),
        finishedAt: now(),
      };

      set((s) => {
        const approvals = awaiting
          ? [
              {
                id: newId('apr'),
                organizationId: op.organizationId,
                operationId: op.id,
                executionId: execId,
                stepId: steps.find((st) => st.state === 'awaiting_approval')?.stepId,
                state: 'pending' as const,
                requestedAt: now(),
                approverIds: op.approverIds,
              },
              ...s.data.approvals,
            ]
          : s.data.approvals;

        // Debita do orçamento da área.
        const budgets = s.data.budgets.map((b) =>
          b.areaId === op.areaId ? { ...b, spent: b.spent + budgetDebited } : b,
        );
        const workUnits = s.data.workUnits.map((w) =>
          w.areaId === op.areaId
            ? { ...w, used: w.used + workUnitsUsed, available: Math.max(0, w.available - workUnitsUsed) }
            : w,
        );

        return {
          data: {
            ...s.data,
            executions: [execution, ...s.data.executions],
            evidence: [...newEvidence, ...s.data.evidence],
            approvals,
            budgets,
            workUnits,
          },
        };
      });

      // 9. Grava evento de auditoria: execução iniciada + evidência registrada.
      get().recordAudit({
        action: 'execution.started',
        objectType: 'Execution',
        objectId: execId,
        newValue: { state: execution.state, test },
        relatedOperationId: op.id,
        relatedExecutionId: execId,
      });
      get().recordAudit({
        action: 'execution.evidence_recorded',
        objectType: 'Execution',
        objectId: execId,
        newValue: { evidenceCount: newEvidence.length },
        relatedOperationId: op.id,
        relatedExecutionId: execId,
        evidenceId: newEvidence[0]?.id,
      });

      return execution;
    },

    resolveApproval: (id, decision, justification) => {
      const { session } = get();
      set((s) => ({
        data: {
          ...s.data,
          approvals: s.data.approvals.map((a) =>
            a.id === id
              ? {
                  ...a,
                  state: decision,
                  resolvedAt: now(),
                  resolverId: session?.person.id,
                  justification,
                }
              : a,
          ),
        },
      }));
      get().recordAudit({
        action: `approval.${decision}`,
        objectType: 'Approval',
        objectId: id,
        newValue: { state: decision },
        justification,
      });
    },

    completeDeploymentStep: (deploymentId, stepId) => {
      set((s) => ({
        data: {
          ...s.data,
          deployments: s.data.deployments.map((d) =>
            d.id === deploymentId ? completeStep(d, stepId) : d,
          ),
        },
      }));
      const d = get().data.deployments.find((x) => x.id === deploymentId);
      const step = d?.steps.find((x) => x.id === stepId);
      get().recordAudit({
        action: 'deployment.step_completed',
        objectType: 'DeploymentStep',
        objectId: stepId,
        newValue: { done: true, step: step?.name },
      });
      if (d?.completed) {
        get().recordAudit({
          action: 'deployment.completed',
          objectType: 'Deployment',
          objectId: deploymentId,
          newValue: { completed: true },
        });
      }
    },

    redoDeploymentStep: (deploymentId, stepId) => {
      // Refazer uma etapa desfaz as seguintes.
      set((s) => ({
        data: {
          ...s.data,
          deployments: s.data.deployments.map((d) =>
            d.id === deploymentId ? redoStep(d, stepId) : d,
          ),
        },
      }));
      get().recordAudit({
        action: 'deployment.step_redo',
        objectType: 'DeploymentStep',
        objectId: stepId,
        newValue: { done: false },
      });
    },

    quarantineFile: (id) => {
      set((s) => ({
        data: {
          ...s.data,
          files: s.data.files.map((f) =>
            f.id === id
              ? {
                  ...f,
                  state: 'quarantined',
                  quarantinedAt: now(),
                  recoverableUntil: new Date(Date.now() + 30 * 86_400_000).toISOString(),
                }
              : f,
          ),
        },
      }));
      get().recordAudit({
        action: 'file.quarantine',
        objectType: 'ManagedFile',
        objectId: id,
        newValue: { state: 'quarantined' },
      });
    },

    restoreFile: (id) => {
      set((s) => ({
        data: {
          ...s.data,
          files: s.data.files.map((f) =>
            f.id === id ? { ...f, state: 'active', quarantinedAt: undefined } : f,
          ),
        },
      }));
      get().recordAudit({
        action: 'file.restore',
        objectType: 'ManagedFile',
        objectId: id,
        newValue: { state: 'active' },
      });
    },

    requestFileDeletion: (id, approverId) => {
      set((s) => ({
        data: {
          ...s.data,
          files: s.data.files.map((f) =>
            f.id === id
              ? { ...f, state: 'deletion_requested', deletionApprovers: [approverId] }
              : f,
          ),
        },
      }));
      get().recordAudit({
        action: 'file.delete.request',
        objectType: 'ManagedFile',
        objectId: id,
        newValue: { state: 'deletion_requested', approvers: [approverId] },
      });
    },

    approveFileDeletion: (id, approverId) => {
      // Exclusão definitiva exige dois aprovadores nomeados distintos.
      set((s) => ({
        data: {
          ...s.data,
          files: s.data.files.map((f) => {
            if (f.id !== id) return f;
            const approvers = f.deletionApprovers.includes(approverId)
              ? f.deletionApprovers
              : [...f.deletionApprovers, approverId];
            const twoApprovers = new Set(approvers).size >= 2;
            return {
              ...f,
              deletionApprovers: approvers,
              state: twoApprovers ? 'deleted' : 'deletion_requested',
            };
          }),
        },
      }));
      const file = get().data.files.find((f) => f.id === id);
      get().recordAudit({
        action: file?.state === 'deleted' ? 'file.delete.approve' : 'file.delete.second_pending',
        objectType: 'ManagedFile',
        objectId: id,
        newValue: { state: file?.state, approvers: file?.deletionApprovers },
      });
    },

    // ── Pessoas ──────────────────────────────────────────────────────────
    invitePerson: (input) => {
      const { organizationId, session } = get();
      const person: Person = {
        id: newId('p'),
        organizationId,
        companyId: session?.person.companyId,
        name: input.name,
        email: input.email,
        roleKeys: input.roleKeys,
        status: 'invited',
      };
      set((s) => ({ data: { ...s.data, people: [...s.data.people, person] } }));
      get().recordAudit({
        action: 'people.invite',
        objectType: 'Person',
        objectId: person.id,
        newValue: { name: person.name, roleKeys: person.roleKeys, status: 'invited' },
      });
      return person;
    },

    updatePersonRoles: (id, roleKeys) => {
      const prev = get().data.people.find((p) => p.id === id);
      set((s) => ({
        data: {
          ...s.data,
          people: s.data.people.map((p) => (p.id === id ? { ...p, roleKeys } : p)),
        },
      }));
      get().recordAudit({
        action: 'role.change',
        objectType: 'Person',
        objectId: id,
        previousValue: { roleKeys: prev?.roleKeys },
        newValue: { roleKeys },
      });
    },

    suspendPerson: (id) => {
      set((s) => ({
        data: {
          ...s.data,
          people: s.data.people.map((p) => (p.id === id ? { ...p, status: 'suspended' } : p)),
        },
      }));
      get().recordAudit({
        action: 'people.suspend',
        objectType: 'Person',
        objectId: id,
        newValue: { status: 'suspended' },
      });
    },

    reactivatePerson: (id) => {
      set((s) => ({
        data: {
          ...s.data,
          people: s.data.people.map((p) => (p.id === id ? { ...p, status: 'active' } : p)),
        },
      }));
      get().recordAudit({
        action: 'people.reactivate',
        objectType: 'Person',
        objectId: id,
        newValue: { status: 'active' },
      });
    },

    // ── Políticas ────────────────────────────────────────────────────────
    createPolicy: (input) => {
      const { organizationId } = get();
      const policy: Policy = {
        id: newId('pol'),
        organizationId,
        level: input.level,
        name: input.name,
        state: 'draft',
      };
      set((s) => ({ data: { ...s.data, policies: [...s.data.policies, policy] } }));
      get().recordAudit({
        action: 'policy.create',
        objectType: 'Policy',
        objectId: policy.id,
        newValue: { name: policy.name, level: policy.level, state: 'draft' },
      });
      return policy;
    },

    submitPolicy: (id) => transitionPolicy(get, set, id, 'submitted', 'policy.submit'),
    publishPolicy: (id) => transitionPolicy(get, set, id, 'published', 'policy.publish'),
    suspendPolicy: (id) => transitionPolicy(get, set, id, 'suspended', 'policy.suspend'),

    // ── Integrações ──────────────────────────────────────────────────────
    connectIntegration: (id) => {
      set((s) => ({
        data: {
          ...s.data,
          integrations: s.data.integrations.map((i) =>
            i.id === id ? { ...i, status: 'connected' } : i,
          ),
        },
      }));
      get().recordAudit({
        action: 'integration.connect',
        objectType: 'Integration',
        objectId: id,
        newValue: { status: 'connected' },
      });
    },

    testIntegration: (id) => {
      set((s) => ({
        data: {
          ...s.data,
          integrations: s.data.integrations.map((i) =>
            i.id === id ? { ...i, status: 'connected', lastTestedAt: now() } : i,
          ),
        },
      }));
      get().recordAudit({
        action: 'integration.test',
        objectType: 'Integration',
        objectId: id,
        newValue: { status: 'connected', tested: true },
      });
    },

    disconnectIntegration: (id) => {
      set((s) => ({
        data: {
          ...s.data,
          integrations: s.data.integrations.map((i) =>
            i.id === id ? { ...i, status: 'disconnected' } : i,
          ),
        },
      }));
      get().recordAudit({
        action: 'integration.disconnect',
        objectType: 'Integration',
        objectId: id,
        newValue: { status: 'disconnected' },
      });
    },

    // ── Contexto ─────────────────────────────────────────────────────────
    addContextSource: (input) => {
      const { organizationId } = get();
      const source = {
        id: newId('ctx'),
        organizationId,
        name: input.name,
        kind: input.kind,
        version: 1,
      };
      set((s) => ({ data: { ...s.data, contextSources: [...s.data.contextSources, source] } }));
      get().recordAudit({
        action: 'context.add',
        objectType: 'ContextSource',
        objectId: source.id,
        newValue: { name: source.name, version: 1 },
      });
    },

    versionContextSource: (id) => {
      const prev = get().data.contextSources.find((c) => c.id === id);
      set((s) => ({
        data: {
          ...s.data,
          contextSources: s.data.contextSources.map((c) =>
            c.id === id ? { ...c, version: c.version + 1 } : c,
          ),
        },
      }));
      get().recordAudit({
        action: 'context.version',
        objectType: 'ContextSource',
        objectId: id,
        previousValue: { version: prev?.version },
        newValue: { version: (prev?.version ?? 0) + 1 },
      });
    },

    // ── Work Units / Orçamento ───────────────────────────────────────────
    requestWorkUnits: (input) => {
      const { organizationId } = get();
      const request = {
        id: newId('wureq'),
        organizationId,
        areaId: input.areaId,
        amount: input.amount,
        justification: input.justification,
        state: 'pending' as const,
      };
      set((s) => ({
        data: { ...s.data, workUnitRequests: [request, ...s.data.workUnitRequests] },
      }));
      get().recordAudit({
        action: 'budget.overage.request',
        objectType: 'WorkUnitRequest',
        objectId: request.id,
        newValue: { amount: request.amount },
        justification: input.justification,
      });
    },

    approveWorkUnitRequest: (id) => {
      const req = get().data.workUnitRequests.find((r) => r.id === id);
      set((s) => ({
        data: {
          ...s.data,
          workUnitRequests: s.data.workUnitRequests.map((r) =>
            r.id === id ? { ...r, state: 'approved' } : r,
          ),
          workUnits: s.data.workUnits.map((w) =>
            req && w.areaId === req.areaId
              ? { ...w, contracted: w.contracted + req.amount, available: w.available + req.amount }
              : w,
          ),
        },
      }));
      get().recordAudit({
        action: 'budget.overage.approve',
        objectType: 'WorkUnitRequest',
        objectId: id,
        newValue: { state: 'approved', amount: req?.amount },
      });
    },

    setBudget: (id, total) => {
      const prev = get().data.budgets.find((b) => b.id === id);
      set((s) => ({
        data: {
          ...s.data,
          budgets: s.data.budgets.map((b) => (b.id === id ? { ...b, total } : b)),
        },
      }));
      get().recordAudit({
        action: 'budget.define',
        objectType: 'Budget',
        objectId: id,
        previousValue: { total: prev?.total },
        newValue: { total },
      });
    },

    // ── Exceções ─────────────────────────────────────────────────────────
    resolveException: (id) => {
      set((s) => ({
        data: {
          ...s.data,
          exceptions: s.data.exceptions.map((e) =>
            e.id === id ? { ...e, state: 'resolved' } : e,
          ),
        },
      }));
      get().recordAudit({
        action: 'exception.resolve',
        objectType: 'OperationException',
        objectId: id,
        newValue: { state: 'resolved' },
      });
    },

    reprocessException: (id) => {
      set((s) => ({
        data: {
          ...s.data,
          exceptions: s.data.exceptions.map((e) =>
            e.id === id ? { ...e, state: 'reprocessing' } : e,
          ),
        },
      }));
      get().recordAudit({
        action: 'exception.reprocess',
        objectType: 'OperationException',
        objectId: id,
        newValue: { state: 'reprocessing' },
      });
    },

    // ── Relatórios ───────────────────────────────────────────────────────
    exportReport: (reportId) => {
      get().recordAudit({
        action: 'report.export',
        objectType: 'Report',
        objectId: reportId,
        newValue: { exported: true },
      });
    },

    markNotificationsRead: () => {
      set((s) => ({
        data: {
          ...s.data,
          notifications: s.data.notifications.map((n) => ({ ...n, read: true })),
        },
      }));
    },
  };
});

type SetFn = (partial: Partial<AppState> | ((s: AppState) => Partial<AppState>)) => void;
type GetFn = () => AppState;

function transitionPolicy(
  get: GetFn,
  set: SetFn,
  id: string,
  state: Policy['state'],
  action: string,
) {
  const prev = get().data.policies.find((p) => p.id === id);
  set((s) => ({
    data: {
      ...s.data,
      policies: s.data.policies.map((p) => (p.id === id ? { ...p, state } : p)),
    },
  }));
  get().recordAudit({
    action,
    objectType: 'Policy',
    objectId: id,
    previousValue: { state: prev?.state },
    newValue: { state },
  });
}

function completeStep(d: Deployment, stepId: string): Deployment {
  const idx = d.steps.findIndex((s) => s.id === stepId);
  if (idx < 0) return d;
  // Trava sequencial: só conclui se todas as anteriores estão concluídas.
  const priorDone = d.steps.slice(0, idx).every((s) => s.done);
  if (!priorDone) return d;
  const steps = d.steps.map((s, i) =>
    i === idx ? { ...s, done: true, completedAt: now() } : s,
  );
  const completed = steps.every((s) => s.done);
  return { ...d, steps, completed, completedAt: completed ? now() : undefined };
}

function redoStep(d: Deployment, stepId: string): Deployment {
  const idx = d.steps.findIndex((s) => s.id === stepId);
  if (idx < 0) return d;
  // Refazer desfaz a etapa e todas as seguintes.
  const steps = d.steps.map((s, i) =>
    i >= idx ? { ...s, done: false, completedAt: undefined } : s,
  );
  return { ...d, steps, completed: false, completedAt: undefined };
}
