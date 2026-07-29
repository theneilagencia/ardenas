import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/ui/PageHeader';
import { useScopedData } from '@/hooks/use-session';
import { formatDate } from '@/lib/format';
import type { Lang } from '@/i18n';

export function EvidencePage() {
  const { t, i18n } = useTranslation();
  const { evidence, operations } = useScopedData();
  const lang = i18n.language as Lang;

  const opName = (id?: string) => operations.find((o) => o.id === id)?.name;

  return (
    <>
      <PageHeader title={t('evidence.title')} />
      <div className="card">
        {evidence.length === 0 ? (
          <div className="empty-state">{t('common.empty')}</div>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('evidence.type')}</th>
                  <th>{t('evidence.label')}</th>
                  <th>{t('operations.title')}</th>
                  <th>{t('evidence.created')}</th>
                </tr>
              </thead>
              <tbody>
                {evidence.map((e) => (
                  <tr key={e.id}>
                    <td>
                      <code className="mono">{e.type}</code>
                    </td>
                    <td>{e.label}</td>
                    <td>{opName(e.operationId) ?? '—'}</td>
                    <td className="mono" style={{ whiteSpace: 'nowrap' }}>
                      {formatDate(e.createdAt, lang)}
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
