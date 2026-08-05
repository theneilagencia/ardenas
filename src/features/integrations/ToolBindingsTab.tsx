import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { usePermission } from '@/hooks/use-session';
import {
  useConnections,
  useConnectorTools,
  useCreateToolBinding,
  useDisableToolBinding,
  useToolBindings,
} from '@/hooks/use-connectors';
import { ArdenRepositoryError } from '@/services/errors';
import type { OrganizationToolBinding } from '@/contracts';

export function ToolBindingsTab() {
  const { t } = useTranslation();
  const can = usePermission();
  const { bindings, isLoading, error, refetch } = useToolBindings();
  const { connections } = useConnections({ status: 'ACTIVE' });
  const createMut = useCreateToolBinding();
  const disableMut = useDisableToolBinding();

  const [name, setName] = useState('');
  const [connectionId, setConnectionId] = useState('');
  const [toolKey, setToolKey] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [confirmDisableId, setConfirmDisableId] = useState<string | null>(null);
  const [listMessage, setListMessage] = useState<string | null>(null);

  const selectedConnection = connections.find((c) => c.id === connectionId) ?? null;
  const { tools } = useConnectorTools(selectedConnection?.connectorKey);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setCreateError(null);
    const tool = tools.find((tl) => tl.key === toolKey);
    if (!selectedConnection || !tool || !name.trim()) return;
    try {
      await createMut.mutateAsync({
        connectionId: selectedConnection.id,
        connectorToolKey: tool.key,
        connectorToolVersion: tool.version,
        name: name.trim(),
      });
      setName('');
      setConnectionId('');
      setToolKey('');
    } catch (err) {
      setCreateError(err instanceof ArdenRepositoryError ? err.message : t('data.error'));
    }
  }

  async function onDisable(binding: OrganizationToolBinding) {
    try {
      await disableMut.mutateAsync({ id: binding.id, body: { expectedRevision: binding.revision } });
      setListMessage(null);
    } catch (err) {
      if (err instanceof ArdenRepositoryError && err.code === 'CONFLICT') {
        await refetch();
        setListMessage(t('integrations.common.conflictReloaded'));
      } else {
        setListMessage(err instanceof ArdenRepositoryError ? err.message : t('data.error'));
      }
    }
    setConfirmDisableId(null);
  }

  const canView = can('tool.view');
  const canBind = can('tool.bind');

  if (!canView) {
    return (
      <div className="card">
        <div className="empty-state">{t('integrations.common.noPermission')}</div>
      </div>
    );
  }

  return (
    <>
      {canBind && (
        <div className="card" style={{ marginBottom: 'var(--sp-4)' }}>
          <h2 className="t-section" style={{ marginBottom: 'var(--sp-3)' }}>
            {t('integrations.toolBindings.new')}
          </h2>
          {connections.length === 0 ? (
            <p className="t-micro">{t('integrations.toolBindings.noConnections')}</p>
          ) : (
            <form onSubmit={onCreate}>
              <div className="row" style={{ alignItems: 'flex-end', gap: 'var(--sp-3)', flexWrap: 'wrap' }}>
                <div className="field" style={{ margin: 0, flex: 1, minWidth: 160 }}>
                  <label htmlFor="tb-name">{t('integrations.toolBindings.name')}</label>
                  <input id="tb-name" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="field" style={{ margin: 0, minWidth: 180 }}>
                  <label htmlFor="tb-connection">{t('integrations.toolBindings.connection')}</label>
                  <select
                    id="tb-connection"
                    value={connectionId}
                    onChange={(e) => {
                      setConnectionId(e.target.value);
                      setToolKey('');
                    }}
                  >
                    <option value="">—</option>
                    {connections.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field" style={{ margin: 0, minWidth: 180 }}>
                  <label htmlFor="tb-tool">{t('integrations.toolBindings.tool')}</label>
                  <select
                    id="tb-tool"
                    value={toolKey}
                    onChange={(e) => setToolKey(e.target.value)}
                    disabled={!selectedConnection}
                  >
                    <option value="">—</option>
                    {tools.map((tool) => (
                      <option key={tool.id} value={tool.key}>
                        {tool.name}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={!name.trim() || !selectedConnection || !toolKey || createMut.isPending}
                >
                  {t('integrations.toolBindings.create')}
                </button>
              </div>
              {createError && (
                <p role="alert" style={{ color: 'var(--st-failed)' }}>
                  {createError}
                </p>
              )}
            </form>
          )}
        </div>
      )}

      <div className="card">
        {listMessage && (
          <p role="alert" style={{ color: 'var(--st-waiting)' }}>
            {listMessage}
          </p>
        )}
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
        ) : bindings.length === 0 ? (
          <div className="empty-state">{t('common.empty')}</div>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('integrations.toolBindings.name')}</th>
                  <th>{t('integrations.toolBindings.tool')}</th>
                  <th>{t('common.status')}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {bindings.map((b) => (
                  <tr key={b.id}>
                    <td>{b.name}</td>
                    <td className="mono">
                      {b.connectorToolKey}@{b.connectorToolVersion}
                    </td>
                    <td>
                      <span className="badge">
                        {b.enabled
                          ? t('integrations.toolBindings.enabled')
                          : t('integrations.toolBindings.disabled')}
                      </span>
                    </td>
                    <td>
                      {canBind && b.enabled && (
                        confirmDisableId === b.id ? (
                          <div className="row">
                            <button
                              type="button"
                              className="btn btn-sm btn-ghost"
                              onClick={() => setConfirmDisableId(null)}
                            >
                              {t('common.cancel')}
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm btn-primary"
                              disabled={disableMut.isPending}
                              onClick={() => onDisable(b)}
                            >
                              {t('integrations.toolBindings.disable')}
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-sm btn-ghost"
                            onClick={() => setConfirmDisableId(b.id)}
                          >
                            {t('integrations.toolBindings.disable')}
                          </button>
                        )
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
