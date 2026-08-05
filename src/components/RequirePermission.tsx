import type { ReactNode } from 'react';
import type { Permission } from '@/domain/permissions';
import { PermissionBoundary } from './session/PermissionBoundary';

/**
 * Guarda de rota por permissão. Permissão se aplica à rota, não apenas ao menu.
 * Delega para a `PermissionBoundary` (TenantContext + auditoria de acesso negado).
 */
export function RequirePermission({
  permission,
  children,
}: {
  permission: Permission;
  children: ReactNode;
}) {
  return <PermissionBoundary permission={permission}>{children}</PermissionBoundary>;
}
