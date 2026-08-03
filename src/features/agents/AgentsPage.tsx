/**
 * Arden.AS — lista de agentes + criação (ARDEN-BE-007.7 §11–12).
 * API v1 real via hooks. Estados loading/vazio/erro/sem-permissão. Criação com
 * idempotência (repositório) e navegação para o rascunho da versão.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/ui/PageHeader';
import { Drawer } from '@/components/ui/Drawer';
import { usePermission } from '@/hooks/use-session';
import { useAgents, useCreateAgent } from '@/hooks/use-agents';
import { ArdenRepositoryError } from '@/services/errors';
import type { AgentStatus } from '@/contracts';
import { AgentStatusBadge } from './AgentStatusBadge';

const FILTERS: Array<AgentStatus | 'all'> = ['all', 'DRAFT', 'ACTIVE', 'SUSPENDED', 'REVOKED'];

export function AgentsPage() {
  const { t } = useTranslation();
  const can = usePermission();
  const [filter, setFilter] = useState<AgentStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const { agents, isLoading, error, refetch } = useAgents(filter === 'all' ? {} : { status: filter });
  const filtered = agents.filter((a) => !search || a.name.toLowerCase().includes(search.toLowerCase()) || a.key.includes(search.toLowerCase()));

  const [creating, setCreating] = useState(false);

  return (
    <>
      <PageHeader
        title={t('agents.title')}
        subtitle={t('agents.subtitle')}
        actions={can('agent.create') && (
          <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
            {t('agents.newAgent')}
          </button>
        )}
      />

      <div className="row" style={{ marginBottom: 'var(--sp-4)', flexWrap: 'wrap' }}>
        {FILTERS.map((f) => (
          <button key={f} type="button" className={`btn btn-sm${filter === f ? ' btn-primary' : ' btn-ghost'}`} onClick={() => setFilter(f)}>
            {f === 'all' ? t('common.all') : t(`agents.status.${f}`)}
          </button>
        ))}
        <input
          type="search"
          aria-label={t('agents.searchPlaceholder')}
          placeholder={t('agents.searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ marginLeft: 'auto', minWidth: 220 }}
        />
      </div>

      <div className="card">
        {error ? (
          <div className="empty-state" role="alert">
            {error.code === 'FORBIDDEN' ? t('common.noPermission') : t('data.error')}
            <div className="row" style={{ justifyContent: 'center', marginTop: 8 }}>
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => refetch()}>{t('data.retry')}</button>
            </div>
          </div>
        ) : isLoading ? (
          <div className="empty-state">{t('data.loading')}</div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">{t('common.empty')}</div>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('agents.name')}</th>
                  <th>{t('agents.key')}</th>
                  <th>{t('agents.publishedVersion')}</th>
                  <th>{t('agents.revision')}</th>
                  <th>{t('common.status')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <Link to={`/agents/${a.id}`} style={{ fontWeight: 500 }}>{a.name}</Link>
                      {a.description && <div className="t-micro" style={{ marginTop: 2 }}>{a.description}</div>}
                    </td>
                    <td className="mono">{a.key}</td>
                    <td className="mono">{a.currentPublishedVersionId ? '✓' : <span style={{ color: 'var(--tx2)' }}>{t('agents.noVersion')}</span>}</td>
                    <td className="mono">{a.revision}</td>
                    <td><AgentStatusBadge status={a.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {creating && <CreateAgentDrawer open={creating} onClose={() => setCreating(false)} />}
    </>
  );
}

function CreateAgentDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const create = useCreateAgent();
  const [key, setKey] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      const agent = await create.mutateAsync({ key: key.trim(), name: name.trim(), description: description.trim() || undefined });
      onClose();
      // Direciona para a versão em rascunho recém-criada do agente.
      navigate(`/agents/${agent.id}`);
    } catch (e2) {
      setErr(e2 instanceof ArdenRepositoryError ? e2.message : t('data.error'));
    }
  }

  return (
    <Drawer open={open} onOpenChange={(o) => !o && onClose()} title={t('agents.create')}>
      <form onSubmit={submit} className="stack" style={{ padding: 'var(--sp-4)', gap: 'var(--sp-3)' }}>
        <label className="stack" style={{ gap: 4 }}>
          <span className="t-micro">{t('agents.key')}</span>
          <input value={key} onChange={(e) => setKey(e.target.value)} required pattern="[a-z0-9]+([._-][a-z0-9]+)*" maxLength={80} />
          <span className="t-micro" style={{ color: 'var(--tx2)' }}>{t('agents.keyHint')}</span>
        </label>
        <label className="stack" style={{ gap: 4 }}>
          <span className="t-micro">{t('agents.name')}</span>
          <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} />
        </label>
        <label className="stack" style={{ gap: 4 }}>
          <span className="t-micro">{t('agents.description')}</span>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} rows={2} />
        </label>
        <p className="t-micro" style={{ color: 'var(--tx2)' }}>{t('agents.createHint')}</p>
        {err && <p role="alert" style={{ color: 'var(--st-failed)' }}>{err}</p>}
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>{t('common.cancel')}</button>
          <button type="submit" className="btn btn-primary" disabled={create.isPending}>{t('agents.create')}</button>
        </div>
      </form>
    </Drawer>
  );
}
