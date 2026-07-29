import type { ReactNode } from 'react';
import type { Permission } from '@/domain/permissions';
import { usePermission } from '@/hooks/use-session';
import { AccessDenied } from './AccessDenied';

/**
 * Guarda de rota. Permissão se aplica à rota, não apenas ao menu.
 */
export function RequirePermission({
  permission,
  children,
}: {
  permission: Permission;
  children: ReactNode;
}) {
  const can = usePermission();
  if (!can(permission)) {
    return <AccessDenied permission={permission} />;
  }
  return <>{children}</>;
}
