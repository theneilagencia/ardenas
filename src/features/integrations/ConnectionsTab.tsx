import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Drawer, DrawerField } from '@/components/ui/Drawer';
import { usePermission } from '@/hooks/use-session';
import {
  useActivateConnection,
  useConnectorCatalog,
  useConnections,
  useCreateConnection,
  useCreateCredential,
  useReactivateConnection,
  useRevokeConnection,
  useRotateCredential,
  useSuspendConnection,
  useTestConnection,
} from '@/hooks/use-connectors';
import { ArdenRepositoryError } from '@/services/errors';
import { PRODUCTION_NETWORK_POLICY_DEFAULTS } from '@/contracts';
import type { ConnectionStatus, TestConnectionResult } from '@/contracts';
import { SecretField } from './secret-field';

const STATUS_COLOR: Record<ConnectionStatus, string> = {
  DRAFT: 'var(--st-paused)',
  ACTIVE: 'var(--st-completed)',
  SUSPENDED: 'var(--st-waiting)',
  ERROR: 'var(--st-failed)',
  REVOKED: 'var(--tx2)',
};

function StatusBadge({ status }: { status: ConnectionStatus }) {
  const { t } = useTranslation();
  return (
    <span className="badge">
      <span className="state-dot" style={{ background: STATUS_COLOR[status] }} aria-hidden />
      {t(`integrations.connections.status${status}`)}
    </span>
  );
}

export function ConnectionsTab() {
  const { t } = useTranslation();
  const can = usePermission();
  const { connections, isLoading, error, refetch } = useConnections();
  const { connectors } = useConnectorCatalog();
  const creatableConnectors = connectors.filter(
    (c) => c.productionAllowed && (c.category === 'HTTP' || c.category === 'WEBHOOK'),
  );

  const createConnMut = useCreateConnection();
  const createCredMut = useCreateCredential();
  const testMut = useTestConnection();
  const activateMut = useActivateConnection();
  const suspendMut = useSuspendConnection();
  const reactivateMut = useReactivateConnection();
  const revokeMut = useRevokeConnection();
  const rotateCredMut = useRotateCredential();

  const [name, setName] = useState('');
  const [connectorKey, setConnectorKey] = useState('');
  const [urlValue, setUrlValue] = useState('');
  const [secretValue, setSecretValue] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = connections.find((c) => c.id === selectedId) ?? null;
  const [testResult, setTestResult] = useState<TestConnectionResult | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const [drawerMessage, setDrawerMessage] = useState<string | null>(null);
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const [rotateSecretValue, setRotateSecretValue] = useState('');
  const [rotateError, setRotateError] = useState<string | null>(null);

  const selectedConnector = creatableConnectors.find((c) => c.key === connectorKey) ?? null;

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setCreateError(null);
    const connector = connectors.find((c) => c.key === connectorKey);
    if (!connector || !name.trim() || !urlValue.trim()) return;
    try {
      const configuration =
        connector.category === 'WEBHOOK' ? { endpointUrl: urlValue.trim() } : { baseUrl: urlValue.trim() };
      const conn = await createConnMut.mutateAsync({
        connectorKey: connector.key,
        connectorVersion: connector.version,
        name: name.trim(),
        configuration,
      });
      if (secretValue.trim()) {
        const secret =
          connector.category === 'WEBHOOK'
            ? { signingSecret: secretValue.trim() }
            : { scheme: 'BEARER_TOKEN', token: secretValue.trim() };
        await createCredMut.mutateAsync({ connectionId: conn.id, body: { secret } });
      }
      setName('');
      setConnectorKey('');
      setUrlValue('');
      setSecretValue('');
    } catch (err) {
      setCreateError(err instanceof ArdenRepositoryError ? err.message : t('data.error'));
    }
  }

  function openConnection(id: string) {
    setSelectedId(id);
    setTestResult(null);
    setTestError(null);
    setDrawerMessage(null);
    setConfirmRevoke(false);
    setRotateSecretValue('');
    setRotateError(null);
  }

  // Nunca reter segredo além do ciclo de vida do formulário: some ao fechar/trocar.
  useEffect(() => {
    return () => setRotateSecretValue('');
  }, [selectedId]);

  async function onRotateCredential() {
    if (!selected || !rotateSecretValue.trim()) return;
    setRotateError(null);
    try {
      await rotateCredMut.mutateAsync({
        connectionId: selected.id,
        body: { secret: { scheme: 'BEARER_TOKEN', token: rotateSecretValue.trim() } },
      });
      setRotateSecretValue('');
    } catch (err) {
      setRotateError(err instanceof ArdenRepositoryError ? err.message : t('data.error'));
    }
  }

  async function onTest() {
    if (!selected) return;
    setTestResult(null);
    setTestError(null);
    try {
      const result = await testMut.mutateAsync({ id: selected.id, body: {} });
      setTestResult(result);
    } catch (err) {
      setTestError(err instanceof ArdenRepositoryError ? err.message : t('data.error'));
    }
  }

  async function runCommand(action: () => Promise<unknown>) {
    if (!selected) return;
    try {
      await action();
      setDrawerMessage(null);
    } catch (err) {
      if (err instanceof ArdenRepositoryError && err.code === 'CONFLICT') {
        await refetch();
        setDrawerMessage(t('integrations.common.conflictReloaded'));
      } else {
        setDrawerMessage(err instanceof ArdenRepositoryError ? err.message : t('data.error'));
      }
    }
  }

  const canView = can('connection.view');
  const canCreate = can('connection.create');
  const canEdit = can('connection.edit');
  const canTest = can('connection.test');
  const canRevoke = can('connection.revoke');
  const canRotate = can('connection.rotate_credentials');

  if (!canView) {
    return (
      <div className="card">
        <div className="empty-state">{t('integrations.common.noPermission')}</div>
      </div>
    );
  }

  return (
    <>
      {canCreate && (
        <div className="card" style={{ marginBottom: 'var(--sp-4)' }}>
          <h2 className="t-section" style={{ marginBottom: 'var(--sp-3)' }}>
            {t('integrations.connections.new')}
          </h2>
          <form onSubmit={onCreate}>
            <div className="row" style={{ alignItems: 'flex-start', gap: 'var(--sp-3)', flexWrap: 'wrap' }}>
              <div className="field" style={{ margin: 0, flex: 1, minWidth: 160 }}>
                <label htmlFor="conn-name">{t('integrations.connections.name')}</label>
                <input id="conn-name" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="field" style={{ margin: 0, minWidth: 160 }}>
                <label htmlFor="conn-connector">{t('integrations.connections.connector')}</label>
                <select
                  id="conn-connector"
                  value={connectorKey}
                  onChange={(e) => setConnectorKey(e.target.value)}
                >
                  <option value="">—</option>
                  {creatableConnectors.map((c) => (
                    <option key={c.key} value={c.key}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field" style={{ margin: 0, flex: 1, minWidth: 220 }}>
                <label htmlFor="conn-url">
                  {selectedConnector?.category === 'WEBHOOK'
                    ? t('integrations.connections.endpointUrl')
                    : t('integrations.connections.baseUrl')}
                </label>
                <input
                  id="conn-url"
                  value={urlValue}
                  onChange={(e) => setUrlValue(e.target.value)}
                  placeholder="https://"
                />
              </div>
            </div>

            {selectedConnector && (
              <div style={{ marginBottom: 'var(--sp-4)' }}>
                <div className="t-micro">{t('integrations.connections.networkPolicy')}</div>
                <p style={{ color: 'var(--tx2)', fontSize: '0.8125rem', margin: '4px 0' }}>
                  {t('integrations.connections.networkPolicyHint')}
                </p>
                <div className="row">
                  <span className="chip mono">
                    protocols: {PRODUCTION_NETWORK_POLICY_DEFAULTS.allowedProtocols.join(', ')}
                  </span>
                  <span className="chip mono">
                    ports: {PRODUCTION_NETWORK_POLICY_DEFAULTS.allowedPorts.join(', ')}
                  </span>
                  <span className="chip mono">redirects: {String(PRODUCTION_NETWORK_POLICY_DEFAULTS.allowRedirects)}</span>
                </div>
              </div>
            )}

            {canRotate && (
              <SecretField
                id="conn-secret"
                label={t('integrations.connections.secretValue')}
                value={secretValue}
                onChange={setSecretValue}
              />
            )}

            {createError && (
              <p role="alert" style={{ color: 'var(--st-failed)' }}>
                {createError}
              </p>
            )}

            <button
              type="submit"
              className="btn btn-primary"
              disabled={
                !name.trim() ||
                !connectorKey ||
                !urlValue.trim() ||
                createConnMut.isPending ||
                createCredMut.isPending
              }
            >
              {t('integrations.connections.create')}
            </button>
          </form>
        </div>
      )}

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
        ) : connections.length === 0 ? (
          <div className="empty-state">{t('common.empty')}</div>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('integrations.connections.name')}</th>
                  <th>{t('integrations.connections.connector')}</th>
                  <th>{t('common.status')}</th>
                  <th>{t('integrations.connections.lastTested')}</th>
                </tr>
              </thead>
              <tbody>
                {connections.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <button
                        type="button"
                        onClick={() => openConnection(c.id)}
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
                    </td>
                    <td className="mono">{c.connectorKey}</td>
                    <td>
                      <StatusBadge status={c.status} />
                    </td>
                    <td className="mono">
                      {c.lastTestedAt ?? t('integrations.connections.neverTested')}
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
        onOpenChange={(o) => {
          if (!o) {
            setSelectedId(null);
            setRotateSecretValue('');
          }
        }}
        title={selected?.name ?? ''}
      >
        {selected && (
          <>
            <DrawerField label={t('integrations.connections.connector')} value={selected.connectorKey} />
            <DrawerField label={t('common.status')} value={<StatusBadge status={selected.status} />} />
            <DrawerField label={t('integrations.common.expectedRevision')} value={selected.revision} />
            <DrawerField
              label={t('integrations.connections.lastTested')}
              value={selected.lastTestedAt ?? t('integrations.connections.neverTested')}
            />
            {selected.lastErrorSummary && (
              <DrawerField label={t('data.error')} value={selected.lastErrorSummary} />
            )}

            {drawerMessage && (
              <p role="alert" style={{ color: 'var(--st-waiting)' }}>
                {drawerMessage}
              </p>
            )}

            {canTest && (
              <div style={{ marginBottom: 'var(--sp-4)' }}>
                <button type="button" className="btn btn-sm btn-ghost" onClick={onTest} disabled={testMut.isPending}>
                  {testMut.isPending ? t('integrations.connections.testing') : t('integrations.connections.test')}
                </button>
                {testResult && (
                  <div style={{ marginTop: 8 }}>
                    <span className="badge">
                      {testResult.status === 'SUCCESS'
                        ? t('integrations.connections.testSuccess')
                        : t('integrations.connections.testFailure')}
                    </span>
                    {testResult.latencyMs !== null && (
                      <span className="chip mono" style={{ marginLeft: 6 }}>
                        {t('integrations.connections.latency')}: {testResult.latencyMs}ms
                      </span>
                    )}
                    {testResult.credentialFingerprint && (
                      <span className="chip mono" style={{ marginLeft: 6 }}>
                        {t('integrations.connections.fingerprint')}: {testResult.credentialFingerprint}
                      </span>
                    )}
                    {testResult.errorSummary && <p>{testResult.errorSummary}</p>}
                  </div>
                )}
                {testError && (
                  <p role="alert" style={{ color: 'var(--st-failed)' }}>
                    {testError}
                  </p>
                )}
              </div>
            )}

            <div className="row" style={{ flexWrap: 'wrap' }}>
              {canEdit && selected.status === 'DRAFT' && (
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  disabled={activateMut.isPending}
                  onClick={() =>
                    runCommand(() =>
                      activateMut.mutateAsync({ id: selected.id, body: { expectedRevision: selected.revision } }),
                    )
                  }
                >
                  {t('integrations.connections.activate')}
                </button>
              )}
              {canEdit && (selected.status === 'ACTIVE' || selected.status === 'ERROR') && (
                <button
                  type="button"
                  className="btn btn-sm btn-ghost"
                  disabled={suspendMut.isPending}
                  onClick={() =>
                    runCommand(() =>
                      suspendMut.mutateAsync({ id: selected.id, body: { expectedRevision: selected.revision } }),
                    )
                  }
                >
                  {t('integrations.connections.suspend')}
                </button>
              )}
              {canEdit && (selected.status === 'SUSPENDED' || selected.status === 'ERROR') && (
                <button
                  type="button"
                  className="btn btn-sm btn-ghost"
                  disabled={reactivateMut.isPending}
                  onClick={() =>
                    runCommand(() =>
                      reactivateMut.mutateAsync({ id: selected.id, body: { expectedRevision: selected.revision } }),
                    )
                  }
                >
                  {t('integrations.connections.reactivate')}
                </button>
              )}
              {canRevoke && selected.status !== 'REVOKED' && !confirmRevoke && (
                <button
                  type="button"
                  className="btn btn-sm btn-ghost"
                  onClick={() => setConfirmRevoke(true)}
                >
                  {t('integrations.connections.revoke')}
                </button>
              )}
            </div>

            {canRotate && selected.status !== 'REVOKED' && (
              <div style={{ marginTop: 'var(--sp-4)' }}>
                <div className="t-micro">{t('integrations.connections.credential')}</div>
                <SecretField
                  id="conn-rotate-secret"
                  label={t('integrations.connections.secretValue')}
                  value={rotateSecretValue}
                  onChange={setRotateSecretValue}
                />
                <button
                  type="button"
                  className="btn btn-sm btn-ghost"
                  disabled={!rotateSecretValue.trim() || rotateCredMut.isPending}
                  onClick={onRotateCredential}
                >
                  {t('integrations.connections.credential')}
                </button>
                {rotateError && (
                  <p role="alert" style={{ color: 'var(--st-failed)' }}>
                    {rotateError}
                  </p>
                )}
              </div>
            )}

            {confirmRevoke && (
              <div className="empty-state" role="alertdialog" aria-label={t('integrations.connections.revokeConfirmTitle')}>
                <p>{t('integrations.connections.revokeConfirmBody')}</p>
                <div className="row" style={{ justifyContent: 'center' }}>
                  <button type="button" className="btn btn-sm btn-ghost" onClick={() => setConfirmRevoke(false)}>
                    {t('common.cancel')}
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-primary"
                    disabled={revokeMut.isPending}
                    onClick={async () => {
                      await runCommand(() =>
                        revokeMut.mutateAsync({ id: selected.id, body: { expectedRevision: selected.revision } }),
                      );
                      setConfirmRevoke(false);
                    }}
                  >
                    {t('integrations.connections.revoke')}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </Drawer>
    </>
  );
}
