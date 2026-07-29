/**
 * Arden.AS — registro de módulos.
 * A navegação e o escopo são reconstruídos a partir das permissões da sessão.
 */

import {
  Activity,
  AlertTriangle,
  BadgeCheck,
  Boxes,
  Building2,
  ClipboardCheck,
  Coins,
  Database,
  FileArchive,
  FileText,
  Gauge,
  GitBranch,
  LayoutDashboard,
  Plug,
  ScrollText,
  Shield,
  ShieldAlert,
  Users,
  Wallet,
  Workflow as WorkflowIcon,
  type LucideIcon,
} from 'lucide-react';
import type { Permission } from '@/domain/permissions';

export interface ModuleDef {
  key: string;
  path: string;
  labelKey: string;
  icon: LucideIcon;
  /** Permissão mínima para ver o módulo. */
  permission: Permission;
  group: 'operate' | 'govern' | 'administer';
}

export const MODULES: ModuleDef[] = [
  { key: 'overview', path: '/', labelKey: 'nav.overview', icon: LayoutDashboard, permission: 'organization.view', group: 'operate' },
  { key: 'operations', path: '/operations', labelKey: 'nav.operations', icon: WorkflowIcon, permission: 'operation.view', group: 'operate' },
  { key: 'executions', path: '/executions', labelKey: 'nav.executions', icon: Activity, permission: 'execution.view', group: 'operate' },
  { key: 'approvals', path: '/approvals', labelKey: 'nav.approvals', icon: ClipboardCheck, permission: 'approval.view', group: 'operate' },
  { key: 'exceptions', path: '/exceptions', labelKey: 'nav.exceptions', icon: AlertTriangle, permission: 'execution.view', group: 'operate' },
  { key: 'evidence', path: '/evidence', labelKey: 'nav.evidence', icon: FileText, permission: 'audit.view', group: 'operate' },
  { key: 'deployment', path: '/deployment', labelKey: 'nav.deployment', icon: GitBranch, permission: 'onboarding.execute', group: 'operate' },

  { key: 'risk', path: '/risk', labelKey: 'nav.risk', icon: ShieldAlert, permission: 'risk.view', group: 'govern' },
  { key: 'policies', path: '/policies', labelKey: 'nav.policies', icon: ScrollText, permission: 'policy.view', group: 'govern' },
  { key: 'security', path: '/security', labelKey: 'nav.security', icon: Shield, permission: 'security.view', group: 'govern' },
  { key: 'audit', path: '/audit', labelKey: 'nav.audit', icon: BadgeCheck, permission: 'audit.view', group: 'govern' },
  { key: 'files', path: '/files', labelKey: 'nav.files', icon: FileArchive, permission: 'file.view', group: 'govern' },

  { key: 'people', path: '/people', labelKey: 'nav.people', icon: Users, permission: 'people.view', group: 'administer' },
  { key: 'roles', path: '/roles', labelKey: 'nav.roles', icon: BadgeCheck, permission: 'role.view', group: 'administer' },
  { key: 'integrations', path: '/integrations', labelKey: 'nav.integrations', icon: Plug, permission: 'integration.view', group: 'administer' },
  { key: 'context', path: '/context', labelKey: 'nav.context', icon: Database, permission: 'context.view', group: 'administer' },
  { key: 'workUnits', path: '/work-units', labelKey: 'nav.workUnits', icon: Coins, permission: 'budget.view', group: 'administer' },
  { key: 'budget', path: '/budget', labelKey: 'nav.budget', icon: Wallet, permission: 'budget.view', group: 'administer' },
  { key: 'environments', path: '/environments', labelKey: 'nav.environments', icon: Boxes, permission: 'operation.view', group: 'administer' },
  { key: 'reports', path: '/reports', labelKey: 'nav.reports', icon: Gauge, permission: 'report.export', group: 'administer' },
  { key: 'organizations', path: '/organizations', labelKey: 'nav.settings', icon: Building2, permission: 'organization.manage', group: 'administer' },
];

export const MODULE_GROUPS: Array<ModuleDef['group']> = ['operate', 'govern', 'administer'];
