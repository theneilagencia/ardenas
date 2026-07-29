import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/ui/PageHeader';
import { useScopedData, usePermission } from '@/hooks/use-session';
import { useAppStore } from '@/store/app-store';

export function ApprovalsPage() {
  const { t } = useTranslation();
  const { approvals, operations } = useScopedData();
  const can = usePermission();
  const resolve = useAppStore((s) => s.resolveApproval);

  const opName = (id: string) => operations.find((o) => o.id === id)?.name ?? id;
  const pending = approvals.filter((a) => a.state === 'pending');
  const resolved = approvals.filter((a) => a.state !== 'pending');
  const canResolve = can('approval.resolve');

  return (
    <>
      <PageHeader title={t('approvals.title')} />
      <div className="card" style={{ marginBottom: 'var(--sp-4)' }}>
        <h2 className="t-section" style={{ marginBottom: 'var(--sp-3)' }}>
          {t('approvals.pending')} ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <div className="empty-state">{t('common.empty')}</div>
        ) : (
          <div className="stack">
            {pending.map((a) => (
              <div
                key={a.id}
                className="row"
                style={{
                  justifyContent: 'space-between',
                  border: '1px solid var(--bd)',
                  borderRadius: 'var(--r-control)',
                  padding: 'var(--sp-3)',
                }}
              >
                <div>
                  <strong>{opName(a.operationId)}</strong>
                  <div style={{ color: 'var(--tx2)' }}>
                    {t('operations.steps')}: {a.stepId ?? '—'}
                  </div>
                </div>
                {canResolve && (
                  <div className="row">
                    <button
                      type="button"
                      className="btn btn-sm btn-ghost"
                      onClick={() => resolve(a.id, 'changes_requested')}
                    >
                      {t('common.requestChanges')}
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-ghost"
                      onClick={() => resolve(a.id, 'rejected')}
                    >
                      {t('common.reject')}
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-primary"
                      onClick={() => resolve(a.id, 'approved')}
                    >
                      {t('common.approve')}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <h2 className="t-section" style={{ marginBottom: 'var(--sp-3)' }}>
          {t('approvals.resolved')} ({resolved.length})
        </h2>
        {resolved.length === 0 ? (
          <div className="empty-state">{t('common.empty')}</div>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('operations.title')}</th>
                  <th>{t('common.status')}</th>
                </tr>
              </thead>
              <tbody>
                {resolved.map((a) => (
                  <tr key={a.id}>
                    <td>{opName(a.operationId)}</td>
                    <td>
                      <code className="mono">{a.state}</code>
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
