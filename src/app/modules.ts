/**
 * Arden.AS — registro de módulos.
 * Os 23 módulos e os cinco grupos do mockup corporativo. A navegação e o escopo
 * são reconstruídos a partir das permissões da sessão.
 */

import {
  Activity,
  BadgeCheck,
  Boxes,
  ClipboardCheck,
  ClipboardList,
  Database,
  FileArchive,
  FileText,
  GaugeCircle,
  GitBranch,
  LayoutDashboard,
  LineChart,
  ListChecks,
  Plug,
  ScrollText,
  Settings,
  Shield,
  ShieldAlert,
  SlidersHorizontal,
  TrendingUp,
  Users,
  Workflow as WorkflowIcon,
  type LucideIcon,
} from 'lucide-react';
import type { Permission } from '@/domain/permissions';

export type ModuleGroup = 'operate' | 'result' | 'control' | 'assessment' | 'company';

export interface ModuleDef {
  key: string;
  path: string;
  labelKey: string;
  icon: LucideIcon;
  /** Permissão mínima para ver o módulo. */
  permission: Permission;
  group: ModuleGroup;
}

export const MODULES: ModuleDef[] = [
  // OPERAÇÃO
  { key: 'overview', path: '/', labelKey: 'nav.overview', icon: LayoutDashboard, permission: 'organization.view', group: 'operate' },
  { key: 'operations', path: '/operations', labelKey: 'nav.operations', icon: WorkflowIcon, permission: 'operation.view', group: 'operate' },
  { key: 'executions', path: '/executions', labelKey: 'nav.executions', icon: Activity, permission: 'execution.view', group: 'operate' },
  { key: 'approvals', path: '/approvals', labelKey: 'nav.approvals', icon: ClipboardCheck, permission: 'approval.view', group: 'operate' },

  // RESULTADO
  { key: 'results', path: '/results', labelKey: 'nav.results', icon: TrendingUp, permission: 'operation.view', group: 'result' },
  { key: 'evidence', path: '/evidence', labelKey: 'nav.evidence', icon: FileText, permission: 'audit.view', group: 'result' },
  { key: 'exceptions', path: '/exceptions', labelKey: 'nav.exceptions', icon: ListChecks, permission: 'execution.view', group: 'result' },

  // CONTROLE
  { key: 'workUnits', path: '/work-units', labelKey: 'nav.workUnits', icon: GaugeCircle, permission: 'budget.view', group: 'control' },
  { key: 'authority', path: '/authority', labelKey: 'nav.authority', icon: SlidersHorizontal, permission: 'risk.view', group: 'control' },
  { key: 'governance', path: '/governance', labelKey: 'nav.governance', icon: ScrollText, permission: 'policy.view', group: 'control' },
  { key: 'risk', path: '/risk', labelKey: 'nav.risk', icon: ShieldAlert, permission: 'risk.view', group: 'control' },
  { key: 'context', path: '/context', labelKey: 'nav.context', icon: Database, permission: 'context.view', group: 'control' },
  { key: 'integrations', path: '/integrations', labelKey: 'nav.integrations', icon: Plug, permission: 'integration.view', group: 'control' },
  { key: 'files', path: '/files', labelKey: 'nav.files', icon: FileArchive, permission: 'file.view', group: 'control' },

  // AVALIAÇÃO
  { key: 'assessment', path: '/assessment', labelKey: 'nav.assessment', icon: ClipboardList, permission: 'operation.view', group: 'assessment' },
  { key: 'evaluator', path: '/evaluator', labelKey: 'nav.evaluator', icon: LineChart, permission: 'operation.view', group: 'assessment' },

  // EMPRESA
  { key: 'deployment', path: '/deployment', labelKey: 'nav.deployment', icon: GitBranch, permission: 'onboarding.execute', group: 'company' },
  { key: 'people', path: '/people', labelKey: 'nav.people', icon: Users, permission: 'people.view', group: 'company' },
  { key: 'security', path: '/security', labelKey: 'nav.security', icon: Shield, permission: 'security.view', group: 'company' },
  { key: 'environments', path: '/environments', labelKey: 'nav.environments', icon: Boxes, permission: 'operation.view', group: 'company' },
  { key: 'audit', path: '/audit', labelKey: 'nav.audit', icon: BadgeCheck, permission: 'audit.view', group: 'company' },
  { key: 'reports', path: '/reports', labelKey: 'nav.reports', icon: GaugeCircle, permission: 'report.export', group: 'company' },
  { key: 'admin', path: '/admin', labelKey: 'nav.admin', icon: Settings, permission: 'organization.manage', group: 'company' },
];

export const MODULE_GROUPS: ModuleGroup[] = ['operate', 'result', 'control', 'assessment', 'company'];

export const GROUP_LABEL_KEY: Record<ModuleGroup, string> = {
  operate: 'navGroup.operate',
  result: 'navGroup.result',
  control: 'navGroup.control',
  assessment: 'navGroup.assessment',
  company: 'navGroup.company',
};
