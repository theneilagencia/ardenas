/**
 * Arden.AS — PermissionBoundary (ARDEN-FE-002).
 * Guarda de rota por permissão. Consulta o TenantContext (PermissionResolver) e,
 * ao bloquear, grava um evento local de auditoria `access.denied`. Isto é
 * ergonomia de interface: o backend revalidará cada ação. Esconder um botão não
 * protege uma ação.
 */

import { useEffect, useRef, type ReactNode } from 'react';
import type { Permission } from '@/domain/permissions';
import { useTenant } from '@/app/tenant-context';
import { useRequestContext } from '@/hooks/use-session';
import { appendAuditEvent } from '@/application';
import { useAppStore } from '@/store/app-store';
import { AccessDenied } from '@/components/AccessDenied';

export function PermissionBoundary({
  permission,
  children,
}: {
  permission: Permission;
  children: ReactNode;
}) {
  const { can } = useTenant();
  const ctx = useRequestContext();
  const allowed = can(permission);
  const loggedRef = useRef<string | null>(null);

  useEffect(() => {
    if (allowed || !ctx) return;
    const key = `${ctx.organizationId}:${permission}`;
    if (loggedRef.current === key) return;
    loggedRef.current = key;
    void appendAuditEvent(ctx, {
      action: 'access.denied',
      objectType: 'Permission',
      objectId: permission,
      newValue: { permission },
      result: 'denied',
    })
      .then(() => useAppStore.getState().bumpAuditVersion())
      .catch(() => {});
  }, [allowed, ctx, permission]);

  if (!allowed) return <AccessDenied permission={permission} />;
  return <>{children}</>;
}
