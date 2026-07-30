import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/ui/PageHeader';
import { OperationStateBadge } from '@/components/ui/StateBadge';
import { usePermission } from '@/hooks/use-session';
import { useOperations } from '@/hooks/use-operations';
import type { OperationStatus } from '@/domain/types';

const FILTERS: Array<OperationStatus | 'all'> = ['all', 'running', 'draft', 'paused', 'archived'];

export function OperationsPage() {
  const { t } = useTranslation();
  const { operations, isLoading, error, refetch } = useOperations();
  const can = usePermission();
  const [filter, setFilter] = useState<OperationStatus | 'all'>('all');

  const filtered = operations.filter((o) => filter === 'all' || o.status === filter);

  return (
    <>
      <PageHeader
        title={t('operations.title')}
        subtitle={t('operations.catalog')}
        actions={
          can('operation.create') && (
            <Link to="/operations/new" className="btn btn-primary">
              {t('operations.newOperation')}
            </Link>
          )
        }
      />

      <div className="row" style={{ marginBottom: 'var(--sp-4)' }}>
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            className={`btn btn-sm${filter === f ? ' btn-primary' : ' btn-ghost'}`}
            onClick={() => setFilter(f)}
          >
            {f === 'all' ? t('operations.catalog') : t(`opStatus.${f}`)}
            <span className="chip mono" style={{ marginLeft: 6 }}>
              {f === 'all' ? operations.length : operations.filter((o) => o.status === f).length}
            </span>
          </button>
        ))}
      </div>

      <div className="card">
        {error ? (
          <div className="empty-state" role="alert">
            {t('data.error')}
            <div className="row" style={{ justifyContent: 'center', marginTop: 8 }}>
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => refetch()}>
                {t('data.retry')}
              </button>
            </div>
          </div>
        ) : isLoading ? (
          <div className="empty-state">{t('data.loading')}</div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">{t('common.empty')}</div>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('operations.title')}</th>
                  <th>{t('common.criticality')}</th>
                  <th>{t('operations.steps')}</th>
                  <th>{t('common.version')}</th>
                  <th>{t('common.status')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((op) => (
                  <tr key={op.id}>
                    <td>
                      <Link to={`/operations/${op.id}`} style={{ fontWeight: 500 }}>
                        {op.name}
                      </Link>
                      <div className="row" style={{ marginTop: 4 }}>
                        {op.tags.map((tag) => (
                          <span key={tag} className="chip">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td>{op.criticality}</td>
                    <td className="mono">{op.steps.length}</td>
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
