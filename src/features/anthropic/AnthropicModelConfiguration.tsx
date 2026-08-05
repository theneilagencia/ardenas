/**
 * Arden.AS — configuração de modelo Anthropic guiada (ARDEN-BE-008.6 §13–§15).
 *
 * INVARIANTES:
 * - Provider FIXO `anthropic.direct` (nunca escolhido livremente).
 * - modelId vem do CATÁLOGO real (allowlist) — nunca texto livre; modelos
 *   DISABLED não são selecionáveis.
 * - Connection vem da lista de conexões Anthropic ATIVAS (allowlist).
 * - Parâmetros validados (tokens de saída obrigatórios; temperatura 0–2).
 * - Criação nasce em DRAFT.
 * - Elegibilidade de ativação é AUTORIDADE DO BACKEND: exibimos um checklist e
 *   BLOQUEAMOS a ativação enquanto o provider não estiver habilitado em produção.
 *   Nesta fase o provider está DISABLED → ativação permanece bloqueada.
 */

import { useMemo, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, XCircle, Ban } from 'lucide-react';
import {
  ANTHROPIC_PROVIDER_KEY,
  ANTHROPIC_PROVIDER_VERSION,
  ANTHROPIC_CONNECTOR_KEY,
} from '@/contracts';
import type { ModelConfiguration, ModelProviderDefinition } from '@/contracts';
import { usePermission } from '@/hooks/use-session';
import { useModelCatalog, useModelConfigurations, useModelProviders, useCreateModelConfiguration } from '@/hooks/use-agents';
import { useConnections } from '@/hooks/use-connectors';
import { ArdenRepositoryError } from '@/services/errors';
import { ModelConfigStatusBadge } from '@/features/agents/AgentStatusBadge';

function ChecklistRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="row" role="status" style={{ gap: 8, alignItems: 'center', padding: '3px 0' }}>
      {ok ? <CheckCircle2 size={15} aria-hidden style={{ color: 'var(--st-completed)' }} /> : <XCircle size={15} aria-hidden style={{ color: 'var(--st-waiting)' }} />}
      <span>{label}</span>
    </div>
  );
}

export function AnthropicModelConfiguration() {
  const { t } = useTranslation();
  const can = usePermission();
  const { providers } = useModelProviders();
  const { models } = useModelCatalog(ANTHROPIC_PROVIDER_KEY, ANTHROPIC_PROVIDER_VERSION);
  const { configurations } = useModelConfigurations();
  const { connections } = useConnections();

  const provider = providers.find((p) => p.key === ANTHROPIC_PROVIDER_KEY);
  const anthropicConfigs = useMemo(
    () => configurations.filter((c) => c.providerKey === ANTHROPIC_PROVIDER_KEY),
    [configurations],
  );
  const anthropicConnections = useMemo(
    () => connections.filter((c) => c.connectorKey === ANTHROPIC_CONNECTOR_KEY),
    [connections],
  );
  const activeConnections = anthropicConnections.filter((c) => c.status === 'ACTIVE');
  // Modelos SELECIONÁVEIS: somente os do catálogo que não estão DISABLED.
  const selectableModels = models.filter((m) => m.status !== 'DISABLED');

  const create = useCreateModelConfiguration();
  const [name, setName] = useState('');
  const [modelId, setModelId] = useState('');
  const [connectionId, setConnectionId] = useState('');
  const [maxOut, setMaxOut] = useState(512);
  const [temperature, setTemperature] = useState('0.2');
  const [err, setErr] = useState<string | null>(null);
  const [okMessage, setOkMessage] = useState<string | null>(null);

  const canCreate = can('model_configuration.create');

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setOkMessage(null);
    const temp = temperature.trim();
    const tempNum = temp === '' ? undefined : Number(temp);
    if (tempNum !== undefined && (Number.isNaN(tempNum) || tempNum < 0 || tempNum > 2)) {
      setErr(t('anthropic.mc.invalidTemperature'));
      return;
    }
    try {
      await create.mutateAsync({
        providerKey: ANTHROPIC_PROVIDER_KEY,
        providerVersion: ANTHROPIC_PROVIDER_VERSION,
        name: name.trim(),
        modelId,
        credentialConnectionId: connectionId || undefined,
        parameters: { maximumOutputTokens: maxOut, ...(tempNum !== undefined ? { temperature: tempNum } : {}) },
      });
      setName('');
      setModelId('');
      setConnectionId('');
      setOkMessage(t('anthropic.mc.created'));
    } catch (e2) {
      setErr(e2 instanceof ArdenRepositoryError ? e2.message : t('data.error'));
    }
  }

  return (
    <section className="card" aria-labelledby="anthropic-mc" style={{ marginTop: 'var(--sp-4)' }}>
      <h2 id="anthropic-mc" className="t-section">{t('anthropic.mc.title')}</h2>
      <p style={{ color: 'var(--tx2)', marginTop: 4 }}>{t('anthropic.mc.note')}</p>

      <AnthropicActivationEligibility provider={provider} hasActiveConnection={activeConnections.length > 0} hasSelectableModel={selectableModels.length > 0} />

      {canCreate && (
        <form onSubmit={submit} className="stack" style={{ gap: 'var(--sp-3)', marginTop: 'var(--sp-3)' }}>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <span className="chip mono">{t('anthropic.mc.provider')}: {ANTHROPIC_PROVIDER_KEY}</span>
            <span className="chip mono">{t('anthropic.fields.providerVersion')}: {ANTHROPIC_PROVIDER_VERSION}</span>
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label htmlFor="anthropic-mc-name">{t('anthropic.mc.name')}</label>
            <input id="anthropic-mc-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} required />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label htmlFor="anthropic-mc-model">{t('anthropic.mc.model')}</label>
            <select id="anthropic-mc-model" value={modelId} onChange={(e) => setModelId(e.target.value)} required>
              <option value="">—</option>
              {selectableModels.map((m) => <option key={m.modelId} value={m.modelId}>{m.displayName}</option>)}
            </select>
            <span className="t-micro" style={{ color: 'var(--tx2)' }}>{t('anthropic.mc.modelFromCatalog')}</span>
            {selectableModels.length === 0 && <span className="t-micro" style={{ color: 'var(--st-waiting)' }}>{t('anthropic.mc.noSelectableModel')}</span>}
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label htmlFor="anthropic-mc-conn">{t('anthropic.mc.connection')}</label>
            <select id="anthropic-mc-conn" value={connectionId} onChange={(e) => setConnectionId(e.target.value)}>
              <option value="">—</option>
              {activeConnections.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <span className="t-micro" style={{ color: 'var(--tx2)' }}>{t('anthropic.mc.connectionAllowlist')}</span>
          </div>
          <div className="grid-tiles">
            <div className="field" style={{ margin: 0 }}>
              <label htmlFor="anthropic-mc-maxout">{t('anthropic.mc.maxOutput')}</label>
              <input id="anthropic-mc-maxout" type="number" min={1} value={maxOut} onChange={(e) => setMaxOut(Number(e.target.value))} required />
            </div>
            <div className="field" style={{ margin: 0 }}>
              <label htmlFor="anthropic-mc-temp">{t('anthropic.mc.temperature')}</label>
              <input id="anthropic-mc-temp" inputMode="decimal" value={temperature} onChange={(e) => setTemperature(e.target.value)} />
            </div>
          </div>
          <p className="t-micro" style={{ color: 'var(--tx2)' }}>{t('anthropic.mc.draftNote')}</p>
          {err && <p role="alert" style={{ color: 'var(--st-failed)' }}>{err}</p>}
          {okMessage && <p role="status" style={{ color: 'var(--st-completed)' }}>{okMessage}</p>}
          <div className="row">
            <button type="submit" className="btn btn-primary" disabled={!name.trim() || !modelId || create.isPending}>{t('anthropic.mc.create')}</button>
          </div>
        </form>
      )}

      <div style={{ marginTop: 'var(--sp-4)' }}>
        <div className="t-micro">{t('anthropic.mc.existing')}</div>
        {anthropicConfigs.length === 0 ? (
          <div className="empty-state">{t('anthropic.mc.empty')}</div>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr><th>{t('anthropic.mc.name')}</th><th>{t('anthropic.catalog.modelId')}</th><th>{t('common.status')}</th><th>{t('anthropic.mc.activation')}</th></tr>
              </thead>
              <tbody>
                {anthropicConfigs.map((c: ModelConfiguration) => (
                  <tr key={c.id}>
                    <td>{c.name}</td>
                    <td className="mono">{c.modelId}</td>
                    <td><ModelConfigStatusBadge status={c.status} /></td>
                    <td>
                      {/* Ativação BLOQUEADA enquanto o provider não é habilitado em produção. §15 */}
                      <span className="chip" style={{ color: 'var(--st-waiting)' }}><Ban size={12} aria-hidden /> {t('anthropic.mc.activationBlocked')}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

/** Checklist de elegibilidade + bloqueio de ativação (§14/§15). */
function AnthropicActivationEligibility({ provider, hasActiveConnection, hasSelectableModel }: {
  provider: ModelProviderDefinition | undefined;
  hasActiveConnection: boolean;
  hasSelectableModel: boolean;
}) {
  const { t } = useTranslation();
  const providerProductionEnabled = provider?.productionAllowed === true && provider?.status === 'ACTIVE';

  return (
    <div className="card" style={{ marginTop: 'var(--sp-3)', borderColor: 'var(--danger, #b3261e)' }} role="group" aria-labelledby="anthropic-eligibility">
      <h3 id="anthropic-eligibility" className="t-section" style={{ fontSize: '0.95rem' }}>{t('anthropic.mc.eligibilityTitle')}</h3>
      <ChecklistRow ok={providerProductionEnabled} label={t('anthropic.mc.eligProvider')} />
      <ChecklistRow ok={hasSelectableModel} label={t('anthropic.mc.eligModel')} />
      <ChecklistRow ok={hasActiveConnection} label={t('anthropic.mc.eligConnection')} />
      <div className="row" role="alert" style={{ gap: 8, alignItems: 'center', marginTop: 8, color: 'var(--st-failed)' }}>
        <Ban size={16} aria-hidden />
        <strong>{t('anthropic.mc.activationBlockedBanner')}</strong>
      </div>
      <p className="t-micro" style={{ color: 'var(--tx2)', marginTop: 4 }}>{t('anthropic.mc.eligibilityNote')}</p>
    </div>
  );
}

export default AnthropicModelConfiguration;
