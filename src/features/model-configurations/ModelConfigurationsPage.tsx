/**
 * Arden.AS — configurações de modelo + catálogo de providers (ARDEN-BE-007.7 §14–16).
 *
 * API v1 real. Provider e modelId vêm do catálogo (allowlist) — nunca texto livre
 * arbitrário; sem provider comercial e sem campo de API key nesta fase. A credencial
 * é referência a conexão do cofre. Lifecycle via comandos do backend. `internal.test-
 * model` é marcado "Somente teste / Não permitido em produção".
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MODEL_RATE_CARDS } from '@/contracts';
import type { ModelConfigurationStatus } from '@/contracts';
import { PageHeader } from '@/components/ui/PageHeader';
import { Drawer } from '@/components/ui/Drawer';
import { usePermission } from '@/hooks/use-session';
import {
  useActivateModelConfiguration,
  useCreateModelConfiguration,
  useModelConfigurations,
  useModelProviders,
  useRevokeModelConfiguration,
  useSuspendModelConfiguration,
} from '@/hooks/use-agents';
import { ArdenRepositoryError } from '@/services/errors';
import { ModelConfigStatusBadge, ModelProviderStatusBadge } from '@/features/agents/AgentStatusBadge';

/** Model IDs conhecidos por provider (catálogo de contrato — allowlist, sem texto livre). */
function modelIdsForProvider(providerKey: string): string[] {
  return Array.from(new Set(MODEL_RATE_CARDS.filter((c) => c.providerKey === providerKey).map((c) => c.modelId)));
}

export function ModelConfigurationsPage() {
  const { t } = useTranslation();
  const can = usePermission();
  const { configurations, isLoading, error, refetch } = useModelConfigurations();
  const { providers } = useModelProviders();
  const [creating, setCreating] = useState(false);

  return (
    <>
      <PageHeader
        title={t('agents.config.title')}
        subtitle={t('agents.config.subtitle')}
        actions={can('model_configuration.create') && (
          <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>{t('agents.config.newConfiguration')}</button>
        )}
      />

      <div className="card" style={{ marginBottom: 'var(--sp-4)' }}>
        <div className="card-head"><h2 className="t-section">{t('agents.providers.title')}</h2></div>
        {providers.length === 0 ? (
          <div className="empty-state">{t('common.empty')}</div>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr><th>{t('agents.name')}</th><th>{t('agents.key')}</th><th>{t('agents.providers.capabilities')}</th><th>{t('agents.providers.productionAllowed')}</th><th>{t('common.status')}</th></tr>
              </thead>
              <tbody>
                {providers.map((p) => (
                  <tr key={p.key}>
                    <td>{p.name}</td>
                    <td className="mono">{p.key}</td>
                    <td>{p.capabilities.map((c) => <span key={c} className="chip">{c}</span>)}</td>
                    <td>{p.productionAllowed ? '✓' : <span className="chip" style={{ color: 'var(--st-waiting)' }}>{t('agents.providers.testOnly')}</span>}</td>
                    <td><ModelProviderStatusBadge status={p.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-head"><h2 className="t-section">{t('agents.config.title')}</h2></div>
        {error ? (
          <div className="empty-state" role="alert">{error.code === 'FORBIDDEN' ? t('common.noPermission') : t('data.error')}
            <div className="row" style={{ justifyContent: 'center', marginTop: 8 }}><button type="button" className="btn btn-sm btn-ghost" onClick={() => refetch()}>{t('data.retry')}</button></div>
          </div>
        ) : isLoading ? (
          <div className="empty-state">{t('data.loading')}</div>
        ) : configurations.length === 0 ? (
          <div className="empty-state">{t('common.empty')}</div>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr><th>{t('agents.name')}</th><th>{t('agents.config.provider')}</th><th>{t('agents.config.modelId')}</th><th>{t('common.status')}</th><th /></tr>
              </thead>
              <tbody>
                {configurations.map((c) => <ConfigRow key={c.id} config={c} canEdit={can('model_configuration.edit')} canRevoke={can('model_configuration.revoke')} />)}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {creating && <CreateConfigDrawer open={creating} onClose={() => setCreating(false)} providers={providers} />}
    </>
  );
}

function ConfigRow({ config, canEdit, canRevoke }: { config: import('@/contracts').ModelConfiguration; canEdit: boolean; canRevoke: boolean }) {
  const { t } = useTranslation();
  const activate = useActivateModelConfiguration();
  const suspend = useSuspendModelConfiguration();
  const revoke = useRevokeModelConfiguration();
  const [err, setErr] = useState<string | null>(null);
  const busy = activate.isPending || suspend.isPending || revoke.isPending;
  const s: ModelConfigurationStatus = config.status;

  async function run(kind: 'activate' | 'suspend' | 'revoke') {
    setErr(null);
    const body = { expectedRevision: config.revision };
    try {
      if (kind === 'revoke' && !window.confirm(t('agents.confirm.revokeConfig'))) return;
      if (kind === 'activate') await activate.mutateAsync({ configurationId: config.id, body });
      else if (kind === 'suspend') await suspend.mutateAsync({ configurationId: config.id, body });
      else await revoke.mutateAsync({ configurationId: config.id, body });
    } catch (e) { setErr(e instanceof ArdenRepositoryError ? e.message : t('data.error')); }
  }

  return (
    <tr>
      <td>{config.name}{err && <div className="t-micro" style={{ color: 'var(--st-failed)' }} role="alert">{err}</div>}</td>
      <td className="mono">{config.providerKey}</td>
      <td className="mono">{config.modelId}</td>
      <td><ModelConfigStatusBadge status={config.status} /></td>
      <td style={{ textAlign: 'right' }}>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          {s === 'DRAFT' && canEdit && <button type="button" className="btn btn-sm btn-ghost" disabled={busy} onClick={() => run('activate')}>{t('agents.actions.activate')}</button>}
          {s === 'ACTIVE' && canEdit && <button type="button" className="btn btn-sm btn-ghost" disabled={busy} onClick={() => run('suspend')}>{t('agents.actions.suspend')}</button>}
          {s === 'SUSPENDED' && canEdit && <button type="button" className="btn btn-sm btn-ghost" disabled={busy} onClick={() => run('activate')}>{t('agents.actions.activate')}</button>}
          {s !== 'REVOKED' && canRevoke && <button type="button" className="btn btn-sm btn-ghost" disabled={busy} onClick={() => run('revoke')}>{t('agents.actions.revoke')}</button>}
        </div>
      </td>
    </tr>
  );
}

function CreateConfigDrawer({ open, onClose, providers }: { open: boolean; onClose: () => void; providers: import('@/contracts').ModelProviderDefinition[] }) {
  const { t } = useTranslation();
  const create = useCreateModelConfiguration();
  const [providerKey, setProviderKey] = useState(providers[0]?.key ?? '');
  const [name, setName] = useState('');
  const [modelId, setModelId] = useState('');
  const [maxOut, setMaxOut] = useState(512);
  const [temperature, setTemperature] = useState('0.2');
  const [err, setErr] = useState<string | null>(null);
  const provider = providers.find((p) => p.key === providerKey);
  const modelIds = modelIdsForProvider(providerKey);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      await create.mutateAsync({
        providerKey,
        providerVersion: '1',
        name: name.trim(),
        modelId: modelId.trim(),
        parameters: { maximumOutputTokens: maxOut, temperature: temperature.trim() === '' ? undefined : Number(temperature) },
      });
      onClose();
    } catch (e2) { setErr(e2 instanceof ArdenRepositoryError ? e2.message : t('data.error')); }
  }

  return (
    <Drawer open={open} onOpenChange={(o) => !o && onClose()} title={t('agents.config.newConfiguration')}>
      <form onSubmit={submit} className="stack" style={{ padding: 'var(--sp-4)', gap: 'var(--sp-3)' }}>
        <label className="stack" style={{ gap: 4 }}>
          <span className="t-micro">{t('agents.config.provider')}</span>
          <select value={providerKey} onChange={(e) => { setProviderKey(e.target.value); setModelId(''); }} required>
            {providers.map((p) => <option key={p.key} value={p.key}>{p.name}{!p.productionAllowed ? ` — ${t('agents.providers.testOnly')}` : ''}</option>)}
          </select>
          {provider && !provider.productionAllowed && <span className="t-micro" style={{ color: 'var(--st-waiting)' }}>{t('agents.providers.notAllowedInProduction')}</span>}
        </label>
        <label className="stack" style={{ gap: 4 }}>
          <span className="t-micro">{t('agents.config.modelId')}</span>
          {modelIds.length > 0 ? (
            <select value={modelId} onChange={(e) => setModelId(e.target.value)} required>
              <option value="">—</option>
              {modelIds.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          ) : (
            <input value={modelId} onChange={(e) => setModelId(e.target.value)} required maxLength={200} />
          )}
          <span className="t-micro" style={{ color: 'var(--tx2)' }}>{t('agents.config.modelIdFromCatalog')}</span>
        </label>
        <label className="stack" style={{ gap: 4 }}>
          <span className="t-micro">{t('agents.name')}</span>
          <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} />
        </label>
        <div className="grid-tiles">
          <label className="stack" style={{ gap: 4 }}>
            <span className="t-micro">{t('agents.config.maximumOutputTokens')}</span>
            <input type="number" value={maxOut} min={1} onChange={(e) => setMaxOut(Number(e.target.value))} required />
          </label>
          <label className="stack" style={{ gap: 4 }}>
            <span className="t-micro">{t('agents.config.temperature')}</span>
            <input inputMode="decimal" value={temperature} onChange={(e) => setTemperature(e.target.value)} />
          </label>
        </div>
        <p className="t-micro" style={{ color: 'var(--tx2)' }}>{t('agents.config.noApiKey')}</p>
        {err && <p role="alert" style={{ color: 'var(--st-failed)' }}>{err}</p>}
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>{t('common.cancel')}</button>
          <button type="submit" className="btn btn-primary" disabled={create.isPending}>{t('agents.config.newConfiguration')}</button>
        </div>
      </form>
    </Drawer>
  );
}
