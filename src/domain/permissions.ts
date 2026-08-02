/**
 * Arden.AS — motor de permissões.
 * Permissão se aplica a rota, componente, botão, campo e exportação — nunca apenas ao menu.
 * Extraído de docs/handoff/PERMISSIONS.md.
 */

import type { Operation, Person, RoleKey } from './types';

export type Permission =
  | 'organization.view'
  | 'organization.manage'
  | 'people.view'
  | 'people.create'
  | 'people.edit'
  | 'people.suspend'
  | 'role.view'
  | 'role.manage'
  | 'operation.view'
  | 'operation.create'
  | 'operation.edit'
  | 'operation.publish'
  | 'operation.pause'
  | 'execution.view'
  | 'execution.start'
  | 'execution.create'
  | 'execution.pause'
  | 'execution.resume'
  | 'execution.cancel'
  | 'execution.retry'
  | 'evidence.view'
  | 'approval.view'
  | 'approval.resolve'
  | 'approval.request'
  | 'approval.cancel'
  | 'approval.delegate'
  | 'policy.view'
  | 'policy.manage'
  | 'policy.create'
  | 'policy.edit'
  | 'policy.publish'
  | 'policy.suspend'
  | 'authority.evaluate'
  | 'risk.view'
  | 'risk.manage'
  | 'integration.view'
  | 'integration.manage'
  // Conectores, conexões, credenciais, ferramentas e webhooks (ARDEN-BE-006).
  | 'connector.view'
  | 'connector.manage'
  | 'connection.view'
  | 'connection.create'
  | 'connection.edit'
  | 'connection.test'
  | 'connection.rotate_credentials'
  | 'connection.revoke'
  | 'tool.view'
  | 'tool.bind'
  | 'webhook.view'
  | 'webhook.manage'
  | 'integration.execute'
  | 'context.view'
  | 'context.manage'
  | 'file.view'
  | 'file.quarantine'
  | 'file.restore'
  | 'file.delete.request'
  | 'file.delete.approve'
  | 'security.view'
  | 'security.manage'
  | 'budget.view'
  | 'budget.manage'
  | 'budget.overage.approve'
  | 'audit.view'
  | 'report.export'
  | 'onboarding.execute';

export const ALL_PERMISSIONS: Permission[] = [
  'organization.view',
  'organization.manage',
  'people.view',
  'people.create',
  'people.edit',
  'people.suspend',
  'role.view',
  'role.manage',
  'operation.view',
  'operation.create',
  'operation.edit',
  'operation.publish',
  'operation.pause',
  'execution.view',
  'execution.start',
  'execution.create',
  'execution.pause',
  'execution.resume',
  'execution.cancel',
  'execution.retry',
  'evidence.view',
  'approval.view',
  'approval.resolve',
  'approval.request',
  'approval.cancel',
  'approval.delegate',
  'policy.view',
  'policy.manage',
  'policy.create',
  'policy.edit',
  'policy.publish',
  'policy.suspend',
  'authority.evaluate',
  'risk.view',
  'risk.manage',
  'integration.view',
  'integration.manage',
  'connector.view',
  'connector.manage',
  'connection.view',
  'connection.create',
  'connection.edit',
  'connection.test',
  'connection.rotate_credentials',
  'connection.revoke',
  'tool.view',
  'tool.bind',
  'webhook.view',
  'webhook.manage',
  'integration.execute',
  'context.view',
  'context.manage',
  'file.view',
  'file.quarantine',
  'file.restore',
  'file.delete.request',
  'file.delete.approve',
  'security.view',
  'security.manage',
  'budget.view',
  'budget.manage',
  'budget.overage.approve',
  'audit.view',
  'report.export',
  'onboarding.execute',
];

/** Permissões concedidas por perfil, derivadas da matriz do handoff. */
export const ROLE_PERMISSIONS: Record<RoleKey, Permission[]> = {
  corporate_admin: [...ALL_PERMISSIONS],
  financial_admin: [
    'organization.view',
    'budget.view',
    'budget.manage',
    'budget.overage.approve',
    'audit.view',
    'report.export',
    'people.view',
    'operation.view',
    'execution.view',
  ],
  operation_owner: [
    'organization.view',
    'operation.view',
    'operation.create',
    'operation.edit',
    'operation.pause',
    'execution.view',
    'execution.start',
    'execution.create',
    'execution.pause',
    'execution.resume',
    'execution.cancel',
    'execution.retry',
    'evidence.view',
    'approval.view',
    'approval.request',
    'authority.evaluate',
    'risk.view',
    'context.view',
    'integration.view',
    'connector.view',
    'connection.view',
    'tool.view',
    'tool.bind',
    'webhook.view',
    'integration.execute',
    'file.view',
    'budget.view',
    'audit.view',
    'report.export',
  ],
  supervisor: [
    'organization.view',
    'operation.view',
    'execution.view',
    'execution.pause',
    'execution.resume',
    'execution.cancel',
    'evidence.view',
    'approval.view',
    'authority.evaluate',
    'risk.view',
    'audit.view',
    'file.view',
    'connector.view',
    'connection.view',
    'connection.test',
    'integration.execute',
  ],
  approver: [
    'organization.view',
    'operation.view',
    'execution.view',
    'approval.view',
    'approval.resolve',
    'approval.request',
    'approval.cancel',
    'approval.delegate',
    'authority.evaluate',
    'audit.view',
    'risk.view',
  ],
  security_admin: [
    'organization.view',
    'security.view',
    'security.manage',
    'policy.view',
    'policy.manage',
    'policy.create',
    'policy.edit',
    'policy.publish',
    'policy.suspend',
    'authority.evaluate',
    'role.view',
    'role.manage',
    'integration.view',
    'integration.manage',
    'connector.view',
    'connector.manage',
    'connection.view',
    'connection.create',
    'connection.edit',
    'connection.test',
    'connection.rotate_credentials',
    'connection.revoke',
    'tool.view',
    'tool.bind',
    'webhook.view',
    'webhook.manage',
    'risk.view',
    'risk.manage',
    'audit.view',
    'file.view',
    'file.quarantine',
    'file.restore',
  ],
  analyst: [
    'organization.view',
    'operation.view',
    'execution.view',
    'audit.view',
    'report.export',
  ],
  auditor: [
    'organization.view',
    'audit.view',
    'approval.view',
    'operation.view',
    'execution.view',
    'risk.view',
    'file.view',
    'connector.view',
    'connection.view',
    'tool.view',
    'webhook.view',
  ],
};

/** Módulos que o Auditor recebe em leitura (selo no cabeçalho). */
export const AUDITOR_READ_MODULES = [
  'audit',
  'operations',
  'executions',
  'approvals',
  'evidence',
  'risk',
  'files',
  'reports',
] as const;

export interface Session {
  person: Person;
  organizationId: ID;
  roleKeys: RoleKey[];
  permissions: Permission[];
}

type ID = string;

export function permissionsFor(roleKeys: RoleKey[]): Permission[] {
  const set = new Set<Permission>();
  for (const key of roleKeys) {
    for (const p of ROLE_PERMISSIONS[key] ?? []) set.add(p);
  }
  return [...set];
}

export interface CanArgs {
  action: Permission;
  session: Session;
  subject?: Operation | { organizationId?: string; companyId?: string } | null;
}

export interface CanResult {
  allowed: boolean;
  reason?:
    | 'suspended'
    | 'missing_permission'
    | 'cross_organization'
    | 'cross_company'
    | 'read_only';
}

/**
 * Motor central de autorização.
 *   can({ action: "operation.publish", subject: operation, session })
 *
 * A autoridade real é barreira de servidor; esta validação é ergonomia.
 */
export function can({ action, session, subject }: CanArgs): CanResult {
  // 8. Usuário suspenso não acessa nenhuma rota.
  if (session.person.status === 'suspended') {
    return { allowed: false, reason: 'suspended' };
  }

  if (!session.permissions.includes(action)) {
    return { allowed: false, reason: 'missing_permission' };
  }

  // Dados não cruzam entre organizações.
  if (subject && 'organizationId' in subject && subject.organizationId) {
    if (subject.organizationId !== session.organizationId) {
      return { allowed: false, reason: 'cross_organization' };
    }
  }

  // 7. Proprietário não administra operação de outra empresa.
  if (
    subject &&
    'companyId' in subject &&
    subject.companyId &&
    session.person.companyId &&
    subject.companyId !== session.person.companyId &&
    !session.roleKeys.includes('corporate_admin') &&
    !session.roleKeys.includes('security_admin')
  ) {
    return { allowed: false, reason: 'cross_company' };
  }

  return { allowed: true };
}

/** Conveniência booleana. */
export function allowed(args: CanArgs): boolean {
  return can(args).allowed;
}

/** Quem concede uma permissão — usado na tela de acesso negado. */
export function grantedBy(permission: Permission): RoleKey {
  if (permission.startsWith('budget')) return 'financial_admin';
  if (permission.startsWith('policy') || permission.startsWith('security'))
    return 'security_admin';
  if (permission.startsWith('role')) return 'security_admin';
  return 'corporate_admin';
}
