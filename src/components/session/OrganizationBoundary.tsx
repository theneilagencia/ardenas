/**
 * Arden.AS — OrganizationBoundary (ARDEN-FE-002).
 * Exige uma organização ativa. Ausência de organização é um estado PRÓPRIO —
 * nunca um erro genérico nem um redirecionamento silencioso.
 */

import type { ReactNode } from 'react';
import { useTenant } from '@/app/tenant-context';
import { SessionStateScreen } from './SessionStateScreen';

export function OrganizationBoundary({ children }: { children: ReactNode }) {
  const { activeOrganization } = useTenant();
  if (!activeOrganization) {
    return (
      <SessionStateScreen
        titleKey="session.noOrganization.title"
        bodyKey="session.noOrganization.body"
        tone="warning"
      />
    );
  }
  return <>{children}</>;
}
