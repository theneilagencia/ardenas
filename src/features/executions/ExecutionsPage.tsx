import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { PageHeader } from '@/components/ui/PageHeader';
import { ExecutionStateBadge } from '@/components/ui/StateBadge';
import { useScopedData } from '@/hooks/use-session';
import { useOperations } from '@/hooks/use-operations';

export function ExecutionsPage() {
  const { t, i18n } = useTranslation();
  const { executions } = useScopedData();
  const { operations } = useOperations();

  const opName = (id: string) => operations.find((o) => o.id === id)?.name ?? id;

  return (
    <>
      <PageHeader title={t('executions.title')} />
      <div className="card">
        {executions.length === 0 ? (
          <div className="empty-state">{t('common.empty')}</div>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('operations.title')}</th>
                  <th>{t('executions.steps')}</th>
                  <th className="mono">{t('executions.workUnits')}</th>
                  <th>{t('common.status')}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {executions.map((e) => (
                  <tr key={e.id}>
                    <td>
                      {opName(e.operationId)}
                      {e.test && (
                        <span className="chip" style={{ marginLeft: 6 }}>
                          {t('executions.test')}
                        </span>
                      )}
                    </td>
                    <td className="mono">{e.steps.length}</td>
                    <td className="mono">
                      {new Intl.NumberFormat(i18n.language).format(e.workUnitsUsed)}
                    </td>
                    <td>
                      <ExecutionStateBadge state={e.state} />
                    </td>
                    <td>
                      <Link to={`/executions/${e.id}`} className="btn btn-ghost btn-sm">
                        {t('common.open')}
                      </Link>
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

export function ExecutionDetailPage() {
  const { t, i18n } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const { executions } = useScopedData();
  const { operations } = useOperations();
  const exec = executions.find((e) => e.id === id);

  if (!exec) return <div className="empty-state">{t('common.empty')}</div>;
  const op = operations.find((o) => o.id === exec.operationId);

  return (
    <>
      <PageHeader
        title={op?.name ?? exec.operationId}
        subtitle={`${t('executions.title')} · ${exec.id}`}
        actions={<ExecutionStateBadge state={exec.state} />}
      />
      <div className="grid-tiles" style={{ marginBottom: 'var(--sp-5)' }}>
        <div className="metric-tile">
          <span className="t-micro">{t('executions.workUnits')}</span>
          <span className="t-metric">{exec.workUnitsUsed}</span>
        </div>
        <div className="metric-tile">
          <span className="t-micro">{t('executions.budgetDebited')}</span>
          <span className="t-metric">
            {new Intl.NumberFormat(i18n.language, { style: 'currency', currency: 'BRL' }).format(
              exec.budgetDebited,
            )}
          </span>
        </div>
      </div>

      <div className="card">
        <h2 className="t-section" style={{ marginBottom: 'var(--sp-3)' }}>
          {t('executions.steps')}
        </h2>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('operations.steps')}</th>
                <th>{t('common.status')}</th>
                <th>{t('executions.evidence')}</th>
                <th className="mono">WU</th>
              </tr>
            </thead>
            <tbody>
              {exec.steps.map((s) => (
                <tr key={s.stepId}>
                  <td>{s.stepName}</td>
                  <td>
                    <code className="mono">{s.state}</code>
                  </td>
                  <td className="mono">{s.evidenceId ?? '—'}</td>
                  <td className="mono">{s.workUnitsUsed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
