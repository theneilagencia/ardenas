import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/ui/PageHeader';
import { useScopedData, usePermission } from '@/hooks/use-session';
import { useAppStore } from '@/store/app-store';

export function ContextPage() {
  const { t } = useTranslation();
  const { contextSources } = useScopedData();
  const can = usePermission();
  const add = useAppStore((s) => s.addContextSource);
  const version = useAppStore((s) => s.versionContextSource);
  const canManage = can('context.manage');

  const [name, setName] = useState('');
  const [kind, setKind] = useState('database');

  return (
    <>
      <PageHeader title={t('context.title')} />

      {canManage && (
        <div className="card" style={{ marginBottom: 'var(--sp-4)' }}>
          <h2 className="t-section" style={{ marginBottom: 'var(--sp-3)' }}>
            {t('context.add')}
          </h2>
          <div className="row" style={{ alignItems: 'flex-end', gap: 'var(--sp-3)' }}>
            <div className="field" style={{ margin: 0, flex: 1, minWidth: 180 }}>
              <label htmlFor="ctx-name">{t('context.name')}</label>
              <input id="ctx-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="field" style={{ margin: 0, minWidth: 160 }}>
              <label htmlFor="ctx-kind">{t('context.kind')}</label>
              <select id="ctx-kind" value={kind} onChange={(e) => setKind(e.target.value)}>
                <option value="database">database</option>
                <option value="document">document</option>
                <option value="api">api</option>
              </select>
            </div>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!name.trim()}
              onClick={() => {
                add({ name: name.trim(), kind });
                setName('');
              }}
            >
              {t('context.add')}
            </button>
          </div>
        </div>
      )}

      <div className="card">
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('context.name')}</th>
                <th>{t('context.kind')}</th>
                <th className="mono">{t('context.versionLabel')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {contextSources.map((c) => (
                <tr key={c.id}>
                  <td>
                    <strong>{c.name}</strong>
                  </td>
                  <td>{c.kind}</td>
                  <td className="mono">v{c.version}</td>
                  <td>
                    {canManage && (
                      <button
                        type="button"
                        className="btn btn-sm btn-ghost"
                        onClick={() => version(c.id)}
                      >
                        {t('context.version')}
                      </button>
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
