/**
 * Arden.AS — painel de uso de agentes de uma execução (ARDEN-BE-007.7 §30, §35).
 *
 * Embutido na tela de detalhe da execução. SOMENTE leitura, API v1 real
 * (`useExecutionAgentUsage`): mostra o resultado operacional das etapas
 * `agent.execute` — status, avaliação, governança, tokens e custo OFICIAIS.
 * Fora do modo api (mock/IndexedDB) o repositório devolve vazio e o painel é oculto.
 * Nunca exibe prompt/output/segredo; custo `null` → "não disponível" (nunca 0,00).
 */

import { useTranslation } from 'react-i18next';
import { ANTHROPIC_PROVIDER_KEY } from '@/contracts';
import { useExecutionAgentUsage } from '@/hooks/use-agents';
import { AgentEvaluationBadge, AgentGovernanceBadge, AgentResultStatusBadge } from '@/features/agents/AgentStatusBadge';
import { COST_UNAVAILABLE, formatCostSummary, formatCount, formatDurationMs } from '@/features/agents/agent-format';

export function ExecutionAgentUsagePanel({ executionRunId }: { executionRunId: string }) {
  const { t } = useTranslation();
  const { results, isLoading } = useExecutionAgentUsage(executionRunId);

  // Sem resultados de agente (ex.: execução sem etapa agent.execute) → não polui a tela.
  if (!isLoading && results.length === 0) return null;

  return (
    <div className="card" style={{ marginTop: 'var(--sp-4)' }}>
      <div className="card-head"><h2 className="t-section">{t('agents.execUsage.title')}</h2></div>
      {isLoading ? (
        <div className="empty-state">{t('data.loading')}</div>
      ) : (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('common.status')}</th>
                <th>{t('agents.execUsage.provider')}</th>
                <th>{t('agents.execUsage.model')}</th>
                <th>{t('agents.results.evaluation')}</th>
                <th>{t('agents.results.governance')}</th>
                <th>{t('agents.results.tokens')}</th>
                <th>{t('agents.results.cost')}</th>
                <th>{t('agents.results.duration')}</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => {
                const cost = formatCostSummary(r.costSummary);
                const isAnthropic = r.usageSummary.providerKey === ANTHROPIC_PROVIDER_KEY;
                return (
                  <tr key={r.id}>
                    <td><AgentResultStatusBadge status={r.status} /></td>
                    <td className="mono">
                      {r.usageSummary.providerKey}
                      {isAnthropic && <span className="chip" style={{ marginLeft: 6, color: 'var(--st-waiting)' }}>{t('agents.execUsage.offlineValidated')}</span>}
                    </td>
                    <td className="mono">{r.usageSummary.modelId}</td>
                    <td><AgentEvaluationBadge status={r.evaluationStatus} /></td>
                    <td><AgentGovernanceBadge status={r.governanceStatus} /></td>
                    <td className="mono">{formatCount(r.usageSummary.inputTokens + r.usageSummary.outputTokens)}</td>
                    <td className="mono">{cost === COST_UNAVAILABLE ? <span style={{ color: 'var(--tx2)' }}>{t('agents.cost.unavailable')}</span> : cost}</td>
                    <td className="mono">{formatDurationMs(r.durationMs)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
