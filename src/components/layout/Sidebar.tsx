import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronsUpDown, Plus } from 'lucide-react';
import { MODULES, MODULE_GROUPS, GROUP_LABEL_KEY } from '@/app/modules';
import { usePermission, useScopedData } from '@/hooks/use-session';
import { useAppStore } from '@/store/app-store';

export function Sidebar() {
  const { t } = useTranslation();
  const permission = usePermission();
  const { organizations } = useScopedData();
  const orgId = useAppStore((s) => s.organizationId);
  const drawerOpen = useAppStore((s) => s.drawerOpen);
  const setDrawerOpen = useAppStore((s) => s.setDrawerOpen);

  const activeOrg = organizations.find((o) => o.id === orgId);
  const visible = MODULES.filter((m) => permission(m.permission));

  return (
    <aside className={`sidebar${drawerOpen ? ' open' : ''}`}>
      <div className="brand">
        <span
          aria-hidden
          className="state-dot"
          style={{ background: 'var(--ac)', width: 10, height: 10 }}
        />
        <span className="brand-mark">Arden.AS</span>
      </div>

      <button
        type="button"
        className="org-switch"
        onClick={() => {
          const next = organizations.find((o) => o.id !== orgId);
          if (next) useAppStore.getState().switchOrganization(next.id);
        }}
        title={t('org.switch')}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="t-micro">{t('org.active')}</div>
          <div style={{ fontWeight: 500, fontSize: '0.8125rem' }}>{activeOrg?.name ?? '—'}</div>
        </div>
        <ChevronsUpDown size={15} aria-hidden />
      </button>

      {permission('operation.create') && (
        <NavLink
          to="/operations/new"
          className="btn btn-primary"
          style={{ margin: '6px 12px 10px' }}
          onClick={() => setDrawerOpen(false)}
        >
          <Plus size={15} aria-hidden />
          {t('operations.newOperation')}
        </NavLink>
      )}

      <nav className="nav" aria-label={t('nav.overview')}>
        {MODULE_GROUPS.map((group) => {
          const items = visible.filter((m) => m.group === group);
          if (items.length === 0) return null;
          return (
            <div key={group}>
              <div className="t-micro nav-group-label">{t(GROUP_LABEL_KEY[group])}</div>
              {items.map((m) => {
                const Icon = m.icon;
                return (
                  <NavLink
                    key={m.key}
                    to={m.path}
                    end={m.path === '/'}
                    className="nav-item"
                    onClick={() => setDrawerOpen(false)}
                  >
                    <Icon size={16} aria-hidden />
                    {t(m.labelKey)}
                  </NavLink>
                );
              })}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
