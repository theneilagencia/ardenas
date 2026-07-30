import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/ui/PageHeader';
import { Drawer, DrawerField } from '@/components/ui/Drawer';
import { useScopedData, usePermission } from '@/hooks/use-session';
import { useAppStore } from '@/store/app-store';
import { formatDate } from '@/lib/format';
import type { Lang } from '@/i18n';
import type { Integration, IntegrationStatus } from '@/domain/types';

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
  const [selected, setSelected] = useState<Integration | null>(null);

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
                    <button
                      type="button"
                      onClick={() => setSelected(i)}
                      style={{
                        border: 0,
                        background: 'none',
                        padding: 0,
                        cursor: 'pointer',
                        color: 'var(--tx)',
                        font: 'inherit',
                        fontWeight: 600,
                        textAlign: 'left',
                      }}
                    >
                      {i.name}
                    </button>
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

      <Drawer
        open={selected !== null}
        onOpenChange={(o) => !o && setSelected(null)}
        title={selected?.name ?? ''}
      >
        {selected && (
          <>
            <DrawerField label={t('context.kind')} value={selected.kind} />
            <DrawerField
              label={t('integrations.status')}
              value={
                <span className="badge">
                  <span
                    className="state-dot"
                    style={{ background: STATUS_COLOR[selected.status] }}
                    aria-hidden
                  />
                  {t(STATUS_KEY[selected.status])}
                </span>
              }
            />
            <DrawerField
              label={t('integrations.lastTested')}
              value={
                selected.lastTestedAt
                  ? formatDate(selected.lastTestedAt, lang)
                  : t('integrations.neverTested')
              }
            />
            <DrawerField label="ID" value={<code className="mono">{selected.id}</code>} />
          </>
        )}
      </Drawer>
    </>
  );
}
