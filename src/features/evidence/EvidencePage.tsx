import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/ui/PageHeader';
import { Drawer, DrawerField } from '@/components/ui/Drawer';
import { useScopedData } from '@/hooks/use-session';
import { formatDate } from '@/lib/format';
import type { Lang } from '@/i18n';
import type { Evidence } from '@/domain/types';

export function EvidencePage() {
  const { t, i18n } = useTranslation();
  const { evidence, operations, executions } = useScopedData();
  const lang = i18n.language as Lang;
  const [selected, setSelected] = useState<Evidence | null>(null);

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
                  <tr
                    key={e.id}
                    className="clickable-row"
                    onClick={() => setSelected(e)}
                    tabIndex={0}
                    onKeyDown={(ev) => {
                      if (ev.key === 'Enter' || ev.key === ' ') {
                        ev.preventDefault();
                        setSelected(e);
                      }
                    }}
                  >
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

      <Drawer
        open={selected !== null}
        onOpenChange={(o) => !o && setSelected(null)}
        title={selected?.label ?? ''}
      >
        {selected && (
          <>
            <DrawerField label={t('evidence.type')} value={<code className="mono">{selected.type}</code>} />
            <DrawerField label={t('operations.title')} value={opName(selected.operationId) ?? '—'} />
            <DrawerField
              label={t('executions.title')}
              value={
                executions.find((x) => x.id === selected.executionId)
                  ? selected.executionId
                  : '—'
              }
            />
            <DrawerField label={t('evidence.created')} value={formatDate(selected.createdAt, lang)} />
            <DrawerField label="ID" value={<code className="mono">{selected.id}</code>} />
          </>
        )}
      </Drawer>
    </>
  );
}
