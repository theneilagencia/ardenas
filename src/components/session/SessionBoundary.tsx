/**
 * Arden.AS — SessionBoundary (ARDEN-FE-002).
 * Distingue e trata explicitamente cada estado de sessão. Só libera a aplicação
 * quando há sessão autenticada com organização ativa. NÃO é segurança de
 * produção — o backend deverá revalidar cada ação independentemente.
 */

import type { ReactNode } from 'react';
import { useTenant } from '@/app/tenant-context';
import { SessionLoading, SessionStateScreen } from './SessionStateScreen';

export function SessionBoundary({ children }: { children: ReactNode }) {
  const { status, refreshSession } = useTenant();

  switch (status) {
    case 'loading':
      return <SessionLoading />;

    case 'unauthenticated':
      return (
        <SessionStateScreen
          titleKey="session.unauthenticated.title"
          bodyKey="session.unauthenticated.body"
          action={{ labelKey: 'session.reload', onClick: () => window.location.reload() }}
        />
      );

    case 'expired':
      return (
        <SessionStateScreen
          titleKey="session.expired.title"
          bodyKey="session.expired.body"
          tone="warning"
          action={{ labelKey: 'session.refresh', onClick: () => void refreshSession() }}
          secondary={{ labelKey: 'session.reload', onClick: () => window.location.reload() }}
        />
      );

    case 'suspended':
      return (
        <SessionStateScreen
          titleKey="session.suspended.title"
          bodyKey="session.suspended.body"
          tone="danger"
        />
      );

    case 'no_organization':
      return (
        <SessionStateScreen
          titleKey="session.noOrganization.title"
          bodyKey="session.noOrganization.body"
          tone="warning"
        />
      );

    case 'error':
      return (
        <SessionStateScreen
          titleKey="session.error.title"
          bodyKey="session.error.body"
          tone="danger"
          action={{ labelKey: 'session.refresh', onClick: () => void refreshSession() }}
        />
      );

    default:
      return <>{children}</>;
  }
}
