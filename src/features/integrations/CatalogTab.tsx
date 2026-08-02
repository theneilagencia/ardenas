import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Drawer, DrawerField } from '@/components/ui/Drawer';
import { usePermission } from '@/hooks/use-session';
import { useConnectorCatalog, useConnectorTools } from '@/hooks/use-connectors';

/** Catálogo de conectores (leitura pública). Nunca inventa capacidade/ferramenta. */
export function CatalogTab() {
  const { t } = useTranslation();
  const can = usePermission();
  const { connectors, isLoading, error, refetch } = useConnectorCatalog();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const selected = connectors.find((c) => c.key === selectedKey) ?? null;
  const { tools } = useConnectorTools(selected?.key);

  if (!can('connector.view')) {
    return (
      <div className="card">
        <div className="empty-state">{t('integrations.common.noPermission')}</div>
      </div>
    );
  }

  return (
    <>
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
        ) : connectors.length === 0 ? (
          <div className="empty-state">{t('common.empty')}</div>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('integrations.connections.connector')}</th>
                  <th>{t('common.status')}</th>
                  <th>{t('integrations.catalog.capabilities')}</th>
                </tr>
              </thead>
              <tbody>
                {connectors.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <button
                        type="button"
                        onClick={() => setSelectedKey(c.key)}
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
                        {c.name}
                      </button>
                      <div className="t-micro mono">
                        {c.key}@{c.version}
                      </div>
                    </td>
                    <td>
                      <span className="badge">{c.category}</span>{' '}
                      {c.productionAllowed ? (
                        <span className="chip">{t('integrations.catalog.productionAllowed')}</span>
                      ) : (
                        <span className="chip">{t('integrations.catalog.testOnly')}</span>
                      )}
                    </td>
                    <td>
                      <div className="row">
                        {c.capabilityKeys.map((k) => (
                          <span key={k} className="chip mono">
                            {k}
                          </span>
                        ))}
                      </div>
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
        onOpenChange={(o) => !o && setSelectedKey(null)}
        title={selected?.name ?? ''}
      >
        {selected && (
          <>
            {selected.description && (
              <DrawerField label={t('integrations.connections.connector')} value={selected.description} />
            )}
            <DrawerField label={t('common.status')} value={selected.status} />
            <DrawerField
              label={t('integrations.catalog.productionAllowed')}
              value={selected.productionAllowed ? t('common.status') : t('integrations.catalog.testOnly')}
            />
            <DrawerField
              label={t('integrations.catalog.tools')}
              value={
                tools.length === 0 ? (
                  t('common.empty')
                ) : (
                  <ul style={{ margin: 0, paddingLeft: '1.1em' }}>
                    {tools.map((tool) => (
                      <li key={tool.id}>
                        <span className="mono">{tool.key}</span> — {tool.name} ({tool.riskLevel})
                      </li>
                    ))}
                  </ul>
                )
              }
            />
          </>
        )}
      </Drawer>
    </>
  );
}
