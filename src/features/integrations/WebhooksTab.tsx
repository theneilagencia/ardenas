import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Drawer, DrawerField } from '@/components/ui/Drawer';
import { usePermission } from '@/hooks/use-session';
import {
  useConnections,
  useCreateWebhookEndpoint,
  useReactivateWebhookEndpoint,
  useRevokeWebhookEndpoint,
  useSuspendWebhookEndpoint,
  useWebhookEndpoints,
} from '@/hooks/use-connectors';
import { ArdenRepositoryError } from '@/services/errors';
import type { WebhookEndpointSecret, WebhookEndpointStatus, WebhookSignatureScheme } from '@/contracts';
import { SecretField } from './secret-field';

const STATUS_COLOR: Record<WebhookEndpointStatus, string> = {
  ACTIVE: 'var(--st-completed)',
  SUSPENDED: 'var(--st-waiting)',
  REVOKED: 'var(--tx2)',
};

function StatusBadge({ status }: { status: WebhookEndpointStatus }) {
  const { t } = useTranslation();
  return (
    <span className="badge">
      <span className="state-dot" style={{ background: STATUS_COLOR[status] }} aria-hidden />
      {t(`integrations.webhooks.status${status}`)}
    </span>
  );
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="btn btn-sm btn-ghost"
      aria-label={`${t('integrations.webhooks.copy')} ${label}`}
      onClick={() => {
        if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
          navigator.clipboard.writeText(value).catch(() => {});
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? t('integrations.webhooks.copied') : t('integrations.webhooks.copy')}
    </button>
  );
}

export function WebhooksTab() {
  const { t } = useTranslation();
  const can = usePermission();
  const { endpoints, isLoading, error, refetch } = useWebhookEndpoints();
  const { connections } = useConnections({ status: 'ACTIVE' });
  const createMut = useCreateWebhookEndpoint();
  const suspendMut = useSuspendWebhookEndpoint();
  const reactivateMut = useReactivateWebhookEndpoint();
  const revokeMut = useRevokeWebhookEndpoint();

  const [key, setKey] = useState('');
  const [connectionId, setConnectionId] = useState('');
  const [signatureScheme, setSignatureScheme] = useState<WebhookSignatureScheme>('HMAC_SHA256');
  const [allowInsecure, setAllowInsecure] = useState(false);
  const [signingSecret, setSigningSecret] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [oneTimeSecret, setOneTimeSecret] = useState<WebhookEndpointSecret | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = endpoints.find((e) => e.id === selectedId) ?? null;
  const [drawerMessage, setDrawerMessage] = useState<string | null>(null);
  const [confirmRevoke, setConfirmRevoke] = useState(false);

  // O segredo one-time NUNCA sobrevive além deste componente: some ao desmontar.
  useEffect(() => {
    return () => setOneTimeSecret(null);
  }, []);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setCreateError(null);
    if (!key.trim() || !connectionId) return;
    try {
      const result = await createMut.mutateAsync({
        connectionId,
        key: key.trim(),
        signatureScheme,
        replayWindowSeconds: 300,
        allowInsecureNoSignature: signatureScheme === 'NONE' ? allowInsecure : undefined,
        signingSecret: signingSecret.trim() || undefined,
      });
      setOneTimeSecret(result);
      setKey('');
      setConnectionId('');
      setSignatureScheme('HMAC_SHA256');
      setAllowInsecure(false);
      setSigningSecret('');
    } catch (err) {
      setCreateError(err instanceof ArdenRepositoryError ? err.message : t('data.error'));
    }
  }

  function closeOneTime() {
    setOneTimeSecret(null);
  }

  function openEndpoint(id: string) {
    setSelectedId(id);
    setDrawerMessage(null);
    setConfirmRevoke(false);
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

  const canView = can('webhook.view');
  const canManage = can('webhook.manage');

  if (!canView) {
    return (
      <div className="card">
        <div className="empty-state">{t('integrations.common.noPermission')}</div>
      </div>
    );
  }

  return (
    <>
      {canManage && (
        <div className="card" style={{ marginBottom: 'var(--sp-4)' }}>
          <h2 className="t-section" style={{ marginBottom: 'var(--sp-3)' }}>
            {t('integrations.webhooks.new')}
          </h2>
          {connections.length === 0 ? (
            <p className="t-micro">{t('integrations.toolBindings.noConnections')}</p>
          ) : (
            <form onSubmit={onCreate}>
              <div className="row" style={{ alignItems: 'flex-end', gap: 'var(--sp-3)', flexWrap: 'wrap' }}>
                <div className="field" style={{ margin: 0, minWidth: 160 }}>
                  <label htmlFor="wh-key">{t('integrations.webhooks.key')}</label>
                  <input id="wh-key" value={key} onChange={(e) => setKey(e.target.value)} />
                </div>
                <div className="field" style={{ margin: 0, minWidth: 180 }}>
                  <label htmlFor="wh-connection">{t('integrations.webhooks.connection')}</label>
                  <select id="wh-connection" value={connectionId} onChange={(e) => setConnectionId(e.target.value)}>
                    <option value="">—</option>
                    {connections.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field" style={{ margin: 0, minWidth: 180 }}>
                  <label htmlFor="wh-scheme">{t('integrations.webhooks.signatureScheme')}</label>
                  <select
                    id="wh-scheme"
                    value={signatureScheme}
                    onChange={(e) => setSignatureScheme(e.target.value as WebhookSignatureScheme)}
                  >
                    <option value="HMAC_SHA256">HMAC_SHA256</option>
                    <option value="STATIC_BEARER">STATIC_BEARER</option>
                    <option value="NONE">NONE</option>
                  </select>
                </div>
              </div>

              {signatureScheme === 'NONE' && (
                <label className="row" style={{ gap: 6, marginBottom: 'var(--sp-4)' }}>
                  <input
                    type="checkbox"
                    checked={allowInsecure}
                    onChange={(e) => setAllowInsecure(e.target.checked)}
                  />
                  {t('integrations.webhooks.allowInsecure')}
                </label>
              )}

              {signatureScheme !== 'NONE' && (
                <SecretField
                  id="wh-signing-secret"
                  label={t('integrations.webhooks.signingSecret')}
                  value={signingSecret}
                  onChange={setSigningSecret}
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
                  !key.trim() ||
                  !connectionId ||
                  (signatureScheme === 'NONE' && !allowInsecure) ||
                  createMut.isPending
                }
              >
                {t('integrations.webhooks.create')}
              </button>
            </form>
          )}
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
        ) : endpoints.length === 0 ? (
          <div className="empty-state">{t('common.empty')}</div>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('integrations.webhooks.key')}</th>
                  <th>{t('integrations.webhooks.signatureScheme')}</th>
                  <th>{t('common.status')}</th>
                </tr>
              </thead>
              <tbody>
                {endpoints.map((ep) => (
                  <tr key={ep.id}>
                    <td>
                      <button
                        type="button"
                        onClick={() => openEndpoint(ep.id)}
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
                        {ep.key}
                      </button>
                    </td>
                    <td className="mono">{ep.signatureScheme}</td>
                    <td>
                      <StatusBadge status={ep.status} />
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
        onOpenChange={(o) => !o && setSelectedId(null)}
        title={selected?.key ?? ''}
      >
        {selected && (
          <>
            <DrawerField label={t('common.status')} value={<StatusBadge status={selected.status} />} />
            <DrawerField label={t('integrations.webhooks.signatureScheme')} value={selected.signatureScheme} />
            <DrawerField label={t('integrations.common.expectedRevision')} value={selected.revision} />

            {drawerMessage && (
              <p role="alert" style={{ color: 'var(--st-waiting)' }}>
                {drawerMessage}
              </p>
            )}

            <div className="row" style={{ flexWrap: 'wrap' }}>
              {canManage && selected.status === 'ACTIVE' && (
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
                  {t('integrations.webhooks.suspend')}
                </button>
              )}
              {canManage && selected.status === 'SUSPENDED' && (
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
                  {t('integrations.webhooks.reactivate')}
                </button>
              )}
              {canManage && selected.status !== 'REVOKED' && !confirmRevoke && (
                <button type="button" className="btn btn-sm btn-ghost" onClick={() => setConfirmRevoke(true)}>
                  {t('integrations.webhooks.revoke')}
                </button>
              )}
            </div>

            {confirmRevoke && (
              <div className="empty-state" role="alertdialog" aria-label={t('integrations.webhooks.revoke')}>
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
                    {t('integrations.webhooks.revoke')}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </Drawer>

      <Drawer open={oneTimeSecret !== null} onOpenChange={(o) => !o && closeOneTime()} title={t('integrations.webhooks.oneTimeTitle')}>
        {oneTimeSecret && (
          <>
            <p role="alert" style={{ color: 'var(--st-waiting)', fontWeight: 600 }}>
              {t('integrations.webhooks.oneTimeWarning')}
            </p>
            <DrawerField
              label={t('integrations.webhooks.endpointUrl')}
              value={
                <div className="row">
                  <code className="mono">{oneTimeSecret.endpointUrl}</code>
                  <CopyButton value={oneTimeSecret.endpointUrl} label={t('integrations.webhooks.endpointUrl')} />
                </div>
              }
            />
            {oneTimeSecret.endpointToken && (
              <DrawerField
                label={t('integrations.webhooks.token')}
                value={
                  <div className="row">
                    <code className="mono">{oneTimeSecret.endpointToken}</code>
                    <CopyButton value={oneTimeSecret.endpointToken} label={t('integrations.webhooks.token')} />
                  </div>
                }
              />
            )}
            {oneTimeSecret.signingSecret && (
              <DrawerField
                label={t('integrations.webhooks.signingSecret')}
                value={
                  <div className="row">
                    <code className="mono">{oneTimeSecret.signingSecret}</code>
                    <CopyButton value={oneTimeSecret.signingSecret} label={t('integrations.webhooks.signingSecret')} />
                  </div>
                }
              />
            )}
            <button type="button" className="btn btn-primary" onClick={closeOneTime}>
              {t('integrations.webhooks.close')}
            </button>
          </>
        )}
      </Drawer>
    </>
  );
}
