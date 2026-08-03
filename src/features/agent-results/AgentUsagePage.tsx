/**
 * Arden.AS — uso e custos agregados de agentes (ARDEN-BE-007.7 §35–36).
 *
 * SOMENTE leitura. Usa o endpoint de usage (rollups) — NUNCA agrega no browser a
 * partir de páginas incompletas nem recalcula custo. Cada bucket já traz o custo
 * oficial (unidade menor). Custo é sempre estimado; provider interno = zero conhecido.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { AgentUsageRollupDimension } from '@/contracts';
import { PageHeader } from '@/components/ui/PageHeader';
import { useAgentUsage } from '@/hooks/use-agents';
import { formatCount, formatMinorCost } from '@/features/agents/agent-format';

const DIMENSIONS: AgentUsageRollupDimension[] = ['ORGANIZATION', 'OPERATION', 'AGENT_DEFINITION', 'AGENT_VERSION', 'MODEL_CONFIGURATION', 'PROVIDER', 'MODEL'];

export function AgentUsagePage() {
  const { t } = useTranslation();
  const [groupBy, setGroupBy] = useState<AgentUsageRollupDimension>('ORGANIZATION');
  const { buckets, isLoading, error, refetch } = useAgentUsage({ groupBy });

  return (
    <>
      <PageHeader title={t('agents.usage.title')} subtitle={t('agents.usage.subtitle')} />

      <div className="row" style={{ marginBottom: 'var(--sp-4)', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
        <span className="t-micro">{t('agents.usage.groupBy')}</span>
        <select value={groupBy} onChange={(e) => setGroupBy(e.target.value as AgentUsageRollupDimension)} aria-label={t('agents.usage.groupBy')}>
          {DIMENSIONS.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>

      <div className="card">
        {error ? (
          <div className="empty-state" role="alert">{error.code === 'FORBIDDEN' ? t('common.noPermission') : t('data.error')}
            <div className="row" style={{ justifyContent: 'center', marginTop: 8 }}><button type="button" className="btn btn-sm btn-ghost" onClick={() => refetch()}>{t('data.retry')}</button></div>
          </div>
        ) : isLoading ? (
          <div className="empty-state">{t('data.loading')}</div>
        ) : buckets.length === 0 ? (
          <div className="empty-state">{t('agents.usage.empty')}</div>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('agents.usage.dimension')}</th>
                  <th>{t('agents.usage.period')}</th>
                  <th>{t('agents.usage.provider')}</th>
                  <th>{t('agents.usage.model')}</th>
                  <th>{t('agents.usage.executions')}</th>
                  <th>{t('agents.usage.succeeded')}</th>
                  <th>{t('agents.usage.failed')}</th>
                  <th>{t('agents.results.tokens')}</th>
                  <th>{t('agents.usage.totalCost')}</th>
                </tr>
              </thead>
              <tbody>
                {buckets.map((b, i) => {
                  const cost = formatMinorCost(b.estimatedCostMinor, b.currency);
                  return (
                    <tr key={`${b.dimensionId}-${b.periodDate}-${b.modelId}-${i}`}>
                      <td className="mono">{b.dimensionId.slice(0, 12)}</td>
                      <td className="mono">{b.periodDate}</td>
                      <td className="mono">{b.providerKey}</td>
                      <td className="mono">{b.modelId}</td>
                      <td className="mono">{formatCount(b.executionCount)}</td>
                      <td className="mono">{formatCount(b.succeededCount)}</td>
                      <td className="mono">{formatCount(b.failedCount)}</td>
                      <td className="mono">{formatCount(b.inputTokens + b.outputTokens)}</td>
                      <td className="mono">{cost}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
