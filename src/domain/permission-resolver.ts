/**
 * Arden.AS — resolvedor de permissões (ARDEN-FE-002).
 *
 * Ponto único que traduz papéis de uma membership em permissões estáveis. Os
 * identificadores de permissão já são estáveis e com namespace por domínio
 * (`operation.view`, `operation.publish`, `approval.resolve`, `audit.view`, …) —
 * ver `ALL_PERMISSIONS`. Componentes consultam PERMISSÕES, nunca nomes de papel.
 *
 * IMPORTANTE: isto é controle de EXPERIÊNCIA da interface. A autorização real é
 * do backend, que revalida cada ação independentemente do que o cliente decidir.
 */

import { ALL_PERMISSIONS, permissionsFor, type Permission } from './permissions';
import type { Membership } from './identity';
import type { RoleKey } from './types';

/** Catálogo estável de permissões (ordem determinística). */
export const PERMISSION_CATALOG: readonly Permission[] = ALL_PERMISSIONS;

export interface PermissionResolver {
  /** Permissões efetivas para um conjunto de papéis. */
  forRoles(roleIds: RoleKey[]): Permission[];
  /** Permissões efetivas para uma membership ativa (vazio se suspensa/ausente). */
  forMembership(membership: Membership | null): Permission[];
  /** Confere se uma permissão está presente na lista resolvida. */
  can(permissions: readonly Permission[], permission: Permission): boolean;
}

export const permissionResolver: PermissionResolver = {
  forRoles(roleIds) {
    return permissionsFor(roleIds);
  },
  forMembership(membership) {
    if (!membership || membership.status !== 'active') return [];
    return permissionsFor(membership.roleIds);
  },
  can(permissions, permission) {
    return permissions.includes(permission);
  },
};
