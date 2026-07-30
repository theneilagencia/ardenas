import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/ui/PageHeader';
import { useAuditEvents } from '@/hooks/use-audit';
import { formatDate } from '@/lib/format';
import type { Lang } from '@/i18n';

export function SecurityPage() {
  const { t, i18n } = useTranslation();
  const { events: denied } = useAuditEvents({ result: 'denied' });
  const lang = i18n.language as Lang;

  return (
    <>
      <PageHeader title={t('security.title')} subtitle={t('security.subtitle')} />
      <div className="card">
        <h2 className="t-section" style={{ marginBottom: 'var(--sp-3)' }}>
          {t('security.deniedAttempts')} ({denied.length})
        </h2>
        {denied.length === 0 ? (
          <div className="empty-state">{t('security.noDenied')}</div>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('audit.time')}</th>
                  <th>{t('audit.actor')}</th>
                  <th>{t('audit.action')}</th>
                  <th>{t('audit.object')}</th>
                </tr>
              </thead>
              <tbody>
                {denied.map((e) => (
                  <tr key={e.id}>
                    <td className="mono" style={{ whiteSpace: 'nowrap' }}>
                      {formatDate(e.timestamp, lang)}
                    </td>
                    <td>
                      {e.actorId}
                      <div className="t-micro">{t(`role.${e.actorRole}`)}</div>
                    </td>
                    <td>
                      <code className="mono">{e.action}</code>
                    </td>
                    <td className="mono">{e.objectId}</td>
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
