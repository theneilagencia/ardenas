/**
 * Arden.AS — detalhe do agente: lifecycle + versões (ARDEN-BE-007.7 §11, §13, §7).
 * Ações de estado usam os comandos do backend (state machine); nunca inferem
 * transição só no cliente. Concorrência via `expectedRevision` (revision lida).
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { PageHeader } from '@/components/ui/PageHeader';
import { usePermission } from '@/hooks/use-session';
import {
  useAgent,
  useAgentVersions,
  useReactivateAgent,
  useRevokeAgent,
  useSuspendAgent,
} from '@/hooks/use-agents';
import { ArdenRepositoryError } from '@/services/errors';
import type { AgentStatus } from '@/contracts';
import { AgentStatusBadge, AgentVersionStatusBadge } from './AgentStatusBadge';

export function AgentDetailPage() {
  const { t } = useTranslation();
  const { agentId } = useParams<{ agentId: string }>();
  const navigate = useNavigate();
  const can = usePermission();
  const { agent, isLoading, error, refetch } = useAgent(agentId);
  const { versions } = useAgentVersions(agentId);
  const suspend = useSuspendAgent();
  const reactivate = useReactivateAgent();
  const revoke = useRevokeAgent();
  const [actionError, setActionError] = useState<string | null>(null);

  if (isLoading) return <div className="card"><div className="empty-state">{t('data.loading')}</div></div>;
  if (error || !agent) {
    return (
      <div className="card">
        <div className="empty-state" role="alert">
          {error?.code === 'FORBIDDEN' ? t('common.noPermission') : t('data.error')}
          <div className="row" style={{ justifyContent: 'center', marginTop: 8 }}>
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => refetch()}>{t('data.retry')}</button>
          </div>
        </div>
      </div>
    );
  }

  async function run(kind: 'suspend' | 'reactivate' | 'revoke') {
    if (!agent) return;
    setActionError(null);
    const body = { expectedRevision: agent.revision };
    try {
      if (kind === 'revoke' && !window.confirm(t('agents.confirm.revoke'))) return;
      if (kind === 'suspend' && !window.confirm(t('agents.confirm.suspend'))) return;
      if (kind === 'suspend') await suspend.mutateAsync({ agentId: agent.id, body });
      else if (kind === 'reactivate') await reactivate.mutateAsync({ agentId: agent.id, body });
      else await revoke.mutateAsync({ agentId: agent.id, body });
    } catch (e) {
      setActionError(e instanceof ArdenRepositoryError ? e.message : t('data.error'));
    }
  }

  const s: AgentStatus = agent.status;
  const busy = suspend.isPending || reactivate.isPending || revoke.isPending;

  return (
    <>
      <PageHeader
        title={agent.name}
        subtitle={agent.description ?? agent.key}
        actions={
          <div className="row">
            {s === 'ACTIVE' && can('agent.suspend') && <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => run('suspend')}>{t('agents.actions.suspend')}</button>}
            {s === 'SUSPENDED' && can('agent.suspend') && <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => run('reactivate')}>{t('agents.actions.reactivate')}</button>}
            {s !== 'REVOKED' && can('agent.revoke') && <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => run('revoke')}>{t('agents.actions.revoke')}</button>}
            {s !== 'REVOKED' && can('agent.edit') && <button type="button" className="btn btn-primary" onClick={() => navigate(`/agents/${agent.id}/versions/new`)}>{t('agents.actions.newVersion')}</button>}
          </div>
        }
      />

      <div className="card" style={{ marginBottom: 'var(--sp-4)' }}>
        <div className="grid-tiles">
          <Tile label={t('agents.key')} value={<span className="mono">{agent.key}</span>} />
          <Tile label={t('common.status')} value={<AgentStatusBadge status={agent.status} />} />
          <Tile label={t('agents.revision')} value={<span className="mono">{agent.revision}</span>} />
          <Tile label={t('agents.publishedVersion')} value={agent.currentPublishedVersionId ? <span className="mono">{agent.currentPublishedVersionId.slice(0, 8)}</span> : t('agents.noVersion')} />
        </div>
      </div>

      {actionError && <p role="alert" style={{ color: 'var(--st-failed)', marginBottom: 'var(--sp-3)' }}>{actionError}</p>}

      <div className="card">
        <div className="card-head"><h2 className="t-section">{t('agents.versions.title')}</h2></div>
        {versions.length === 0 ? (
          <div className="empty-state">{t('agents.versions.empty')}</div>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('agents.versions.number')}</th>
                  <th>{t('common.status')}</th>
                  <th>{t('agents.revision')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {versions.map((v) => (
                  <tr key={v.id}>
                    <td className="mono">#{v.versionNumber}</td>
                    <td><AgentVersionStatusBadge status={v.status} /></td>
                    <td className="mono">{v.revision}</td>
                    <td style={{ textAlign: 'right' }}>
                      <Link to={`/agents/${agent.id}/versions/${v.id}`} className="btn btn-sm btn-ghost">
                        {v.status === 'DRAFT' && can('agent.edit') ? t('agents.actions.edit') : t('agents.actions.view')}
                      </Link>
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

function Tile({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="metric-tile">
      <div className="t-micro">{label}</div>
      <div style={{ marginTop: 4 }}>{value}</div>
    </div>
  );
}
