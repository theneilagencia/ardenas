import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/ui/PageHeader';
import { OperationStateBadge } from '@/components/ui/StateBadge';
import { useScopedData } from '@/hooks/use-session';

export function DashboardPage() {
  const { t, i18n } = useTranslation();
  const data = useScopedData();

  const pending = data.approvals.filter((a) => a.state === 'pending').length;
  const exceptions = data.exceptions.filter((e) => e.state === 'open').length;
  const available = data.workUnits.reduce((sum, w) => sum + w.available, 0);
  const recent = [...data.operations]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 5);

  return (
    <>
      <PageHeader
        title={t('dashboard.title')}
        actions={
          <Link to="/operations/new" className="btn btn-primary">
            {t('dashboard.newOperation')}
          </Link>
        }
      />

      <div className="grid-tiles" style={{ marginBottom: 'var(--sp-5)' }}>
        <Tile label={t('dashboard.pendingApprovals')} value={pending} to="/approvals" />
        <Tile label={t('dashboard.openExceptions')} value={exceptions} to="/exceptions" />
        <Tile
          label={t('dashboard.workUnits')}
          value={new Intl.NumberFormat(i18n.language).format(available)}
          to="/work-units"
        />
      </div>

      <div className="card">
        <div className="card-head">
          <h2 className="t-section">{t('dashboard.recentOperations')}</h2>
          <Link to="/operations" className="btn btn-ghost btn-sm">
            {t('dashboard.viewCatalog')}
          </Link>
        </div>
        {recent.length === 0 ? (
          <div className="empty-state">{t('common.empty')}</div>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('operations.title')}</th>
                  <th>{t('common.criticality')}</th>
                  <th>{t('common.version')}</th>
                  <th>{t('common.status')}</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((op) => (
                  <tr key={op.id}>
                    <td>
                      <Link to={`/operations/${op.id}`} style={{ fontWeight: 500 }}>
                        {op.name}
                      </Link>
                    </td>
                    <td>{op.criticality}</td>
                    <td className="mono">{op.version}</td>
                    <td>
                      <OperationStateBadge status={op.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

function Tile({ label, value, to }: { label: string; value: number | string; to: string }) {
  return (
    <Link to={to} className="metric-tile" style={{ textDecoration: 'none' }}>
      <span className="t-micro">{label}</span>
      <span className="t-metric">{value}</span>
    </Link>
  );
}
