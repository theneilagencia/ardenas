/**
 * Arden.AS — hooks de sessão (ARDEN-FE-002).
 *
 * NÃO são mais uma fonte de verdade autônoma. A identidade, o tenant e as
 * permissões vêm do `TenantContext` (resolvido pelo `SessionRepository` e pelo
 * `PermissionResolver`). A store guarda apenas um espelho, escrito exclusivamente
 * pelo TenantContext. Esconder um botão não protege uma ação — o backend revalida.
 */

import { useMemo } from 'react';
import { useAppStore } from '@/store/app-store';
import { can as domainCan, type CanArgs, type Permission } from '@/domain/permissions';
import type { Operation } from '@/domain/types';
import { useTenant } from '@/app/tenant-context';
import { toRequestContext, type RequestContext } from '@/application';

/** Sessão espelhada (compatibilidade). A autoridade é o TenantContext. */
export function useSession() {
  return useAppStore((s) => s.session);
}

/** Contexto de requisição derivado da sessão ativa (tenant vem da sessão). */
export function useRequestContext(): RequestContext | null {
  const { session } = useTenant();
  return useMemo(() => toRequestContext(session), [session]);
}

/** Registros da organização ATIVA apenas. Dados não cruzam entre organizações. */
export function useScopedData() {
  const data = useAppStore((s) => s.data);
  const { activeOrganization } = useTenant();
  const orgId = activeOrganization?.id ?? '';
  return {
    // operations e auditEvents foram migrados para repositórios (use-operations /
    // use-audit); não são mais expostos pela store.
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
    deployments: data.deployments.filter((d) => d.organizationId === orgId),
    notifications: data.notifications.filter((n) => n.organizationId === orgId),
    people: data.people.filter((p) => p.organizationId === orgId),
    resultIndicators: data.resultIndicators.filter((r) => r.organizationId === orgId),
    authorityMatrix: data.authorityMatrix.filter((a) => a.organizationId === orgId),
    assessments: data.assessments.filter((a) => a.organizationId === orgId),
    roles: data.roles,
    organizations: data.organizations,
  };
}

/**
 * Avalia permissão com base no TenantContext (PermissionResolver) e mantém as
 * checagens de sujeito (cross-organization/cross-company/suspenso) do domínio.
 */
export function usePermission(): (
  action: Permission,
  subject?: CanArgs['subject'],
) => boolean {
  const { can } = useTenant();
  const session = useAppStore((s) => s.session);
  return (action, subject) => {
    if (!can(action)) return false;
    if (!session) return false;
    return domainCan({ action, session, subject }).allowed;
  };
}

export function useCanEditOperation(op?: Operation | null) {
  const permission = usePermission();
  if (!op) return false;
  return permission('operation.edit', op);
}
