import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/ui/PageHeader';
import { useScopedData, usePermission } from '@/hooks/use-session';
import { useAppStore } from '@/store/app-store';
import type { ExceptionState } from '@/domain/types';

const STATE_KEY: Record<ExceptionState, string> = {
  open: 'exceptions.stateOpen',
  resolved: 'exceptions.stateResolved',
  reprocessing: 'exceptions.stateReprocessing',
};

export function ExceptionsPage() {
  const { t } = useTranslation();
  const { exceptions, operations } = useScopedData();
  const can = usePermission();
  const resolve = useAppStore((s) => s.resolveException);
  const reprocess = useAppStore((s) => s.reprocessException);
  const canResolve = can('execution.resume');

  const opName = (id: string) => operations.find((o) => o.id === id)?.name ?? id;

  return (
    <>
      <PageHeader title={t('exceptions.title')} />
      <div className="card">
        {exceptions.length === 0 ? (
          <div className="empty-state">{t('common.empty')}</div>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('operations.title')}</th>
                  <th>{t('exceptions.reason')}</th>
                  <th>{t('common.status')}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {exceptions.map((e) => (
                  <tr key={e.id}>
                    <td>{opName(e.operationId)}</td>
                    <td>{e.reason}</td>
                    <td>
                      <span className="badge">{t(STATE_KEY[e.state])}</span>
                    </td>
                    <td>
                      {canResolve && e.state === 'open' && (
                        <div className="row">
                          <button
                            type="button"
                            className="btn btn-sm btn-ghost"
                            onClick={() => reprocess(e.id)}
                          >
                            {t('exceptions.reprocess')}
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-primary"
                            onClick={() => resolve(e.id)}
                          >
                            {t('exceptions.resolve')}
                          </button>
                        </div>
                      )}
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
