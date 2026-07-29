import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/ui/PageHeader';
import { useScopedData } from '@/hooks/use-session';
import { formatDate } from '@/lib/format';
import type { Lang } from '@/i18n';

export function AuditPage() {
  const { t, i18n } = useTranslation();
  const { auditEvents } = useScopedData();
  const lang = i18n.language as Lang;

  return (
    <>
      <PageHeader title={t('audit.title')} subtitle={t('audit.subtitle')} />
      <div className="card">
        {auditEvents.length === 0 ? (
          <div className="empty-state">{t('common.empty')}</div>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('audit.time')}</th>
                  <th>{t('audit.actor')}</th>
                  <th>{t('audit.action')}</th>
                  <th>{t('audit.object')}</th>
                  <th>{t('audit.previous')}</th>
                  <th>{t('audit.next')}</th>
                  <th>{t('audit.result')}</th>
                </tr>
              </thead>
              <tbody>
                {auditEvents.map((e) => (
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
                    <td>
                      {e.objectType}
                      <div className="mono" style={{ color: 'var(--tx2)' }}>
                        {e.objectId}
                      </div>
                    </td>
                    <td>
                      <pre className="mono" style={{ fontSize: '0.7rem', whiteSpace: 'pre-wrap' }}>
                        {JSON.stringify(e.previousValue)}
                      </pre>
                    </td>
                    <td>
                      <pre className="mono" style={{ fontSize: '0.7rem', whiteSpace: 'pre-wrap' }}>
                        {JSON.stringify(e.newValue)}
                      </pre>
                    </td>
                    <td>
                      <span
                        className="badge"
                        style={{
                          color:
                            e.result === 'success'
                              ? 'var(--st-completed)'
                              : e.result === 'denied'
                                ? 'var(--st-failed)'
                                : 'var(--st-waiting)',
                        }}
                      >
                        {t(`audit.result${e.result.charAt(0).toUpperCase()}${e.result.slice(1)}`)}
                      </span>
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
