import { Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Eye } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { AssistantPanel } from './AssistantPanel';
import { CommandPalette } from '@/components/CommandPalette';
import { TourOverlay } from '@/components/TourOverlay';
import { useSession } from '@/hooks/use-session';
import { SessionBoundary } from '@/components/session/SessionBoundary';
import { OrganizationBoundary } from '@/components/session/OrganizationBoundary';

export function AppShell() {
  const { t } = useTranslation();
  const session = useSession();
  const isAuditor = session?.roleKeys.includes('auditor') ?? false;

  // A SessionBoundary trata loading/expirada/suspensa/sem-organização/erro/não
  // autenticada ANTES de montar a casca — cada estado tem tela própria.
  return (
    <SessionBoundary>
      <OrganizationBoundary>
        <div className="shell">
          <Sidebar />
          <div className="main">
            <Topbar />
            <main className="content">
              {isAuditor && (
                <div className="auditor-seal" style={{ marginBottom: 'var(--sp-4)' }}>
                  <Eye size={13} aria-hidden />
                  {t('common.readOnlyBadge')} — {t('role.auditor')}
                </div>
              )}
              <Outlet />
            </main>
          </div>
          <AssistantPanel />
          <CommandPalette />
          <TourOverlay />
        </div>
      </OrganizationBoundary>
    </SessionBoundary>
  );
}
