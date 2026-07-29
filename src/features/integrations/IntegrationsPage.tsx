import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/ui/PageHeader';
import { useScopedData, usePermission } from '@/hooks/use-session';
import { useAppStore } from '@/store/app-store';
import { formatDate } from '@/lib/format';
import type { Lang } from '@/i18n';
import type { IntegrationStatus } from '@/domain/types';

const STATUS_KEY: Record<IntegrationStatus, string> = {
  connected: 'integrations.statusConnected',
  disconnected: 'integrations.statusDisconnected',
  error: 'integrations.statusError',
  expired: 'integrations.statusExpired',
};

const STATUS_COLOR: Record<IntegrationStatus, string> = {
  connected: 'var(--st-completed)',
  disconnected: 'var(--st-paused)',
  error: 'var(--st-failed)',
  expired: 'var(--st-waiting)',
};

export function IntegrationsPage() {
  const { t, i18n } = useTranslation();
  const { integrations } = useScopedData();
  const can = usePermission();
  const connect = useAppStore((s) => s.connectIntegration);
  const test = useAppStore((s) => s.testIntegration);
  const disconnect = useAppStore((s) => s.disconnectIntegration);
  const canManage = can('integration.manage');
  const lang = i18n.language as Lang;

  return (
    <>
      <PageHeader title={t('integrations.title')} />
      <div className="card">
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('integrations.title')}</th>
                <th>{t('integrations.status')}</th>
                <th>{t('integrations.lastTested')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {integrations.map((i) => (
                <tr key={i.id}>
                  <td>
                    <strong>{i.name}</strong>
                    <div className="t-micro">{i.kind}</div>
                  </td>
                  <td>
                    <span className="badge">
                      <span
                        className="state-dot"
                        style={{ background: STATUS_COLOR[i.status] }}
                        aria-hidden
                      />
                      {t(STATUS_KEY[i.status])}
                    </span>
                  </td>
                  <td className="mono">
                    {i.lastTestedAt ? formatDate(i.lastTestedAt, lang) : t('integrations.neverTested')}
                  </td>
                  <td>
                    {canManage && (
                      <div className="row">
                        {i.status === 'connected' ? (
                          <>
                            <button
                              type="button"
                              className="btn btn-sm btn-ghost"
                              onClick={() => test(i.id)}
                            >
                              {t('integrations.test')}
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm btn-ghost"
                              onClick={() => disconnect(i.id)}
                            >
                              {t('integrations.disconnect')}
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-sm btn-primary"
                            onClick={() => connect(i.id)}
                          >
                            {t('integrations.connect')}
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
