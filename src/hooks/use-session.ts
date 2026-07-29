import { useAppStore } from '@/store/app-store';
import { can, type CanArgs, type Permission } from '@/domain/permissions';
import type { Operation } from '@/domain/types';

export function useSession() {
  return useAppStore((s) => s.session);
}

/** Registros da organização ativa apenas. Dados não cruzam entre organizações. */
export function useScopedData() {
  const data = useAppStore((s) => s.data);
  const orgId = useAppStore((s) => s.organizationId);
  return {
    operations: data.operations.filter((o) => o.organizationId === orgId),
    executions: data.executions.filter((e) => e.organizationId === orgId),
    approvals: data.approvals.filter((a) => a.organizationId === orgId),
    exceptions: data.exceptions.filter((e) => e.organizationId === orgId),
    evidence: data.evidence.filter((e) => e.organizationId === orgId),
    policies: data.policies.filter((p) => p.organizationId === orgId),
    risks: data.risks.filter((r) => r.organizationId === orgId),
    integrations: data.integrations.filter((i) => i.organizationId === orgId),
    contextSources: data.contextSources.filter((c) => c.organizationId === orgId),
    files: data.files.filter((f) => f.organizationId === orgId),
    workUnits: data.workUnits.filter((w) => w.organizationId === orgId),
    budgets: data.budgets.filter((b) => b.organizationId === orgId),
    auditEvents: data.auditEvents.filter((a) => a.organizationId === orgId),
    deployments: data.deployments.filter((d) => d.organizationId === orgId),
    notifications: data.notifications.filter((n) => n.organizationId === orgId),
    people: data.people.filter((p) => p.organizationId === orgId),
    roles: data.roles,
    organizations: data.organizations,
  };
}

/** Avalia can() com a sessão atual injetada. */
export function usePermission(): (
  action: Permission,
  subject?: CanArgs['subject'],
) => boolean {
  const session = useAppStore((s) => s.session);
  return (action, subject) => {
    if (!session) return false;
    return can({ action, session, subject }).allowed;
  };
}

export function useCanEditOperation(op?: Operation | null) {
  const permission = usePermission();
  if (!op) return false;
  return permission('operation.edit', op);
}
