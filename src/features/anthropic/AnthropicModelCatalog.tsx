/**
 * Arden.AS — catálogo de modelos Anthropic (ARDEN-BE-008.6 §5).
 *
 * Os IDs de modelo vêm SEMPRE do backend (`useModelCatalog`) — nunca digitados
 * livremente nem embutidos no código. Modelos `DISABLED` aparecem claramente
 * bloqueados; limites de token não verificados mostram "Limite não verificado";
 * preço não verificado (sem rate card) mostra "Preço não verificado". Nunca
 * afirma disponibilidade de produção — o provider permanece bloqueado.
 */

import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';
import { ANTHROPIC_PROVIDER_KEY, ANTHROPIC_PROVIDER_VERSION } from '@/contracts';
import type { ModelCatalogEntry } from '@/contracts';
import { useModelCatalog } from '@/hooks/use-agents';
import { ModelProviderStatusBadge } from '@/features/agents/AgentStatusBadge';

function tokenLimit(value: number | null, notVerified: string): string {
  return value == null ? notVerified : new Intl.NumberFormat('pt-BR').format(value);
}

export function AnthropicModelCatalog() {
  const { t } = useTranslation();
  const { models, isLoading, error, refetch } = useModelCatalog(ANTHROPIC_PROVIDER_KEY, ANTHROPIC_PROVIDER_VERSION);

  return (
    <section className="card" aria-labelledby="anthropic-catalog" style={{ marginTop: 'var(--sp-4)' }}>
      <h2 id="anthropic-catalog" className="t-section">{t('anthropic.catalog.title')}</h2>
      <p style={{ color: 'var(--tx2)', marginTop: 4 }}>{t('anthropic.catalog.note')}</p>

      {error ? (
        <div className="empty-state" role="alert">
          {error.code === 'FORBIDDEN' ? t('common.noPermission') : t('anthropic.catalog.loadError')}
          <div className="row" style={{ justifyContent: 'center', marginTop: 8 }}>
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => refetch()}>{t('anthropic.retry')}</button>
          </div>
        </div>
      ) : isLoading ? (
        <p role="status">{t('anthropic.loading')}</p>
      ) : models.length === 0 ? (
        <div className="empty-state">{t('anthropic.catalog.empty')}</div>
      ) : (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('anthropic.catalog.model')}</th>
                <th>{t('anthropic.catalog.modelId')}</th>
                <th>{t('common.status')}</th>
                <th>{t('anthropic.catalog.maxInput')}</th>
                <th>{t('anthropic.catalog.maxOutput')}</th>
                <th>{t('anthropic.catalog.price')}</th>
                <th>{t('anthropic.catalog.selectable')}</th>
              </tr>
            </thead>
            <tbody>
              {models.map((m: ModelCatalogEntry) => {
                const selectable = m.status === 'ACTIVE' && m.productionAllowed;
                return (
                  <tr key={m.modelId}>
                    <td>{m.displayName}</td>
                    <td className="mono">{m.modelId}</td>
                    <td><ModelProviderStatusBadge status={m.status} /></td>
                    <td>{tokenLimit(m.maximumInputTokens, t('anthropic.catalog.limitNotVerified'))}</td>
                    <td>{tokenLimit(m.maximumOutputTokens, t('anthropic.catalog.limitNotVerified'))}</td>
                    <td>{m.rateCardKey == null ? (
                      <span className="row" style={{ gap: 4, alignItems: 'center', color: 'var(--st-waiting)' }}>
                        <AlertTriangle size={13} aria-hidden />{t('anthropic.catalog.priceNotVerified')}
                      </span>
                    ) : <code>{m.rateCardKey}</code>}</td>
                    <td>{selectable ? t('anthropic.yes') : (
                      <span className="chip" style={{ color: 'var(--st-waiting)' }}>{t('anthropic.catalog.notSelectable')}</span>
                    )}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default AnthropicModelCatalog;
