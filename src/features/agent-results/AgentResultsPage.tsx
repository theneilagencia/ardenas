/**
 * Arden.AS — resultados operacionais de agentes (ARDEN-BE-007.7 §33–34).
 *
 * SOMENTE leitura, API v1 é a fonte de verdade: custo, avaliação, usage e governança
 * chegam prontos do servidor e NUNCA são recalculados. A saída completa/prompt/segredo
 * nunca é exibida — só status, contadores, hashes e custo. Custo `null` mostra
 * "Custo não disponível" (nunca "0,00"); zero conhecido mostra o valor formatado.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { AgentOperationalResult, AgentResultStatus } from '@/contracts';
import { PageHeader } from '@/components/ui/PageHeader';
import { Drawer, DrawerField } from '@/components/ui/Drawer';
import { useAgentResults } from '@/hooks/use-agents';
import { AgentEvaluationBadge, AgentGovernanceBadge, AgentResultStatusBadge } from '@/features/agents/AgentStatusBadge';
import { COST_UNAVAILABLE, formatCostSummary, formatCount, formatDurationMs } from '@/features/agents/agent-format';

const FILTERS: Array<AgentResultStatus | 'all'> = ['all', 'SUCCEEDED', 'FAILED', 'SUSPENDED', 'REQUIRES_APPROVAL', 'UNKNOWN'];

function CostText({ result }: { result: AgentOperationalResult }) {
  const { t } = useTranslation();
  const formatted = formatCostSummary(result.costSummary);
  if (formatted === COST_UNAVAILABLE) return <span style={{ color: 'var(--tx2)' }}>{t('agents.cost.unavailable')}</span>;
  return <span className="mono">{formatted}</span>;
}

export function AgentResultsPage() {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<AgentResultStatus | 'all'>('all');
  const { results, isLoading, error, refetch } = useAgentResults(filter === 'all' ? {} : { status: filter });
  const [selected, setSelected] = useState<AgentOperationalResult | null>(null);

  return (
    <>
      <PageHeader title={t('agents.results.title')} subtitle={t('agents.results.subtitle')} />

      <div className="row" style={{ marginBottom: 'var(--sp-4)', flexWrap: 'wrap' }}>
        {FILTERS.map((f) => (
          <button key={f} type="button" className={`btn btn-sm${filter === f ? ' btn-primary' : ' btn-ghost'}`} onClick={() => setFilter(f)}>
            {f === 'all' ? t('common.all') : t(`agents.resultStatus.${f}`)}
          </button>
        ))}
      </div>

      <div className="card">
        {error ? (
          <div className="empty-state" role="alert">{error.code === 'FORBIDDEN' ? t('common.noPermission') : t('data.error')}
            <div className="row" style={{ justifyContent: 'center', marginTop: 8 }}><button type="button" className="btn btn-sm btn-ghost" onClick={() => refetch()}>{t('data.retry')}</button></div>
          </div>
        ) : isLoading ? (
          <div className="empty-state">{t('data.loading')}</div>
        ) : results.length === 0 ? (
          <div className="empty-state">{t('common.empty')}</div>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('common.status')}</th>
                  <th>{t('agents.results.evaluation')}</th>
                  <th>{t('agents.results.governance')}</th>
                  <th>{t('agents.results.tokens')}</th>
                  <th>{t('agents.results.cost')}</th>
                  <th>{t('agents.results.duration')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => setSelected(r)}>
                    <td><AgentResultStatusBadge status={r.status} /></td>
                    <td><AgentEvaluationBadge status={r.evaluationStatus} /></td>
                    <td><AgentGovernanceBadge status={r.governanceStatus} /></td>
                    <td className="mono">{formatCount(r.usageSummary.inputTokens + r.usageSummary.outputTokens)}</td>
                    <td><CostText result={r} /></td>
                    <td className="mono">{formatDurationMs(r.durationMs)}</td>
                    <td style={{ textAlign: 'right' }}><button type="button" className="btn btn-sm btn-ghost" onClick={(e) => { e.stopPropagation(); setSelected(r); }}>{t('common.detail')}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && <ResultDetailDrawer result={selected} onClose={() => setSelected(null)} />}
    </>
  );
}

function ResultDetailDrawer({ result, onClose }: { result: AgentOperationalResult; onClose: () => void }) {
  const { t } = useTranslation();
  const u = result.usageSummary;
  const cost = formatCostSummary(result.costSummary);
  return (
    <Drawer open onOpenChange={(o) => !o && onClose()} title={t('agents.results.detail')}>
      <div style={{ padding: 'var(--sp-4)' }}>
        <h3 className="t-micro">{t('agents.results.summary')}</h3>
        <DrawerField label={t('common.status')} value={<AgentResultStatusBadge status={result.status} />} />
        <DrawerField label={t('agents.results.evaluation')} value={<AgentEvaluationBadge status={result.evaluationStatus} />} />
        <DrawerField label={t('agents.results.governance')} value={<AgentGovernanceBadge status={result.governanceStatus} />} />
        <DrawerField label={t('agents.results.duration')} value={<span className="mono">{formatDurationMs(result.durationMs)}</span>} />

        <h3 className="t-micro" style={{ marginTop: 'var(--sp-4)' }}>{t('agents.results.usage')}</h3>
        <div className="grid-tiles">
          <Metric label={t('agents.results.inputTokens')} value={formatCount(u.inputTokens)} />
          <Metric label={t('agents.results.outputTokens')} value={formatCount(u.outputTokens)} />
          <Metric label={t('agents.results.cachedTokens')} value={formatCount(u.cachedInputTokens + u.cachedOutputTokens)} />
          <Metric label={t('agents.results.modelCalls')} value={String(u.modelCallCount)} />
          <Metric label={t('agents.results.toolCalls')} value={String(u.toolCallCount)} />
          <Metric label={t('agents.results.turns')} value={String(u.turnCount)} />
          <Metric label={t('agents.results.repairs')} value={String(u.repairAttemptCount)} />
          <Metric label={t('agents.results.approvals')} value={String(u.approvalCount)} />
        </div>

        <h3 className="t-micro" style={{ marginTop: 'var(--sp-4)' }}>{t('agents.results.cost')}</h3>
        <DrawerField
          label={t('agents.results.cost')}
          value={cost === COST_UNAVAILABLE
            ? <span style={{ color: 'var(--tx2)' }}>{t('agents.cost.unavailable')}</span>
            : <span className="mono">{cost}{result.costSummary.estimatedCostMinor === 0 ? ` · ${t('agents.cost.estimatedZeroKnown')}` : ''}</span>}
        />
        {result.costSummary.rateCardId && <DrawerField label={t('agents.results.rateCard')} value={<span className="mono">{result.costSummary.rateCardId}</span>} />}

        <h3 className="t-micro" style={{ marginTop: 'var(--sp-4)' }}>{t('agents.results.checks')}</h3>
        {result.evaluationSummary.checks.length === 0 ? (
          <p className="t-micro" style={{ color: 'var(--tx2)' }}>{t('common.empty')}</p>
        ) : (
          <ul style={{ margin: 0, paddingLeft: 'var(--sp-4)' }}>
            {result.evaluationSummary.checks.map((c) => (
              <li key={c.key}>
                <span className="mono">{c.key}</span> — {c.status} {c.severity !== 'INFO' && <span className="chip">{c.severity}</span>}
              </li>
            ))}
          </ul>
        )}

        <h3 className="t-micro" style={{ marginTop: 'var(--sp-4)' }}>{t('agents.results.security')}</h3>
        <DrawerField label={t('agents.results.securitySignals')} value={<span className="mono">{u.securitySignalCount}</span>} />

        <h3 className="t-micro" style={{ marginTop: 'var(--sp-4)' }}>{t('agents.results.evidenceAudit')}</h3>
        <DrawerField label={t('agents.results.evidenceRefs')} value={<span className="mono">{result.evidenceReferenceIds.length}</span>} />
        <p className="t-micro" style={{ color: 'var(--tx2)', marginTop: 4 }}>{t('agents.results.noOutput')}</p>
      </div>
    </Drawer>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric-tile">
      <div className="t-micro">{label}</div>
      <div className="t-metric mono" style={{ marginTop: 2 }}>{value}</div>
    </div>
  );
}
