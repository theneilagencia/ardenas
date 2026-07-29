import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/ui/PageHeader';
import { useScopedData, usePermission } from '@/hooks/use-session';
import { useAppStore } from '@/store/app-store';
import type { PolicyLevel, PolicyState } from '@/domain/types';

const LEVELS: PolicyLevel[] = ['corporate', 'company', 'area', 'local_exception'];
const STATE_KEY: Record<PolicyState, string> = {
  draft: 'policies.stateDraft',
  submitted: 'policies.stateSubmitted',
  approved: 'policies.stateApproved',
  published: 'policies.statePublished',
  suspended: 'policies.stateSuspended',
};
const LEVEL_KEY: Record<PolicyLevel, string> = {
  corporate: 'policies.levelCorporate',
  company: 'policies.levelCompany',
  area: 'policies.levelArea',
  local_exception: 'policies.levelLocal_exception',
};

// Ordem de precedência de cima para baixo.
const LEVEL_ORDER: Record<PolicyLevel, number> = {
  corporate: 0,
  company: 1,
  area: 2,
  local_exception: 3,
};

export function PoliciesPage() {
  const { t } = useTranslation();
  const { policies } = useScopedData();
  const can = usePermission();
  const create = useAppStore((s) => s.createPolicy);
  const submit = useAppStore((s) => s.submitPolicy);
  const publish = useAppStore((s) => s.publishPolicy);
  const suspend = useAppStore((s) => s.suspendPolicy);

  const canManage = can('policy.manage');
  const canPublish = can('policy.publish');

  const [name, setName] = useState('');
  const [level, setLevel] = useState<PolicyLevel>('area');

  const sorted = [...policies].sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level]);

  return (
    <>
      <PageHeader title={t('policies.title')} subtitle={t('policies.subtitle')} />

      {canManage && (
        <div className="card" style={{ marginBottom: 'var(--sp-4)' }}>
          <h2 className="t-section" style={{ marginBottom: 'var(--sp-3)' }}>
            {t('policies.create')}
          </h2>
          <div className="row" style={{ alignItems: 'flex-end', gap: 'var(--sp-3)' }}>
            <div className="field" style={{ margin: 0, flex: 1, minWidth: 200 }}>
              <label htmlFor="pol-name">{t('policies.name')}</label>
              <input id="pol-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="field" style={{ margin: 0, minWidth: 200 }}>
              <label htmlFor="pol-level">{t('policies.level')}</label>
              <select id="pol-level" value={level} onChange={(e) => setLevel(e.target.value as PolicyLevel)}>
                {LEVELS.map((l) => (
                  <option key={l} value={l}>
                    {t(LEVEL_KEY[l])}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!name.trim()}
              onClick={() => {
                create({ name: name.trim(), level });
                setName('');
              }}
            >
              {t('policies.create')}
            </button>
          </div>
        </div>
      )}

      <div className="card">
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('policies.name')}</th>
                <th>{t('policies.level')}</th>
                <th>{t('policies.state')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((p) => (
                <tr key={p.id}>
                  <td>
                    <strong>{p.name}</strong>
                    {p.justification && (
                      <div style={{ color: 'var(--tx2)' }}>{p.justification}</div>
                    )}
                  </td>
                  <td>{t(LEVEL_KEY[p.level])}</td>
                  <td>
                    <span className="badge">{t(STATE_KEY[p.state])}</span>
                  </td>
                  <td>
                    <div className="row">
                      {canManage && p.state === 'draft' && (
                        <button
                          type="button"
                          className="btn btn-sm btn-ghost"
                          onClick={() => submit(p.id)}
                        >
                          {t('policies.submit')}
                        </button>
                      )}
                      {canPublish && (p.state === 'submitted' || p.state === 'approved') && (
                        <button
                          type="button"
                          className="btn btn-sm btn-primary"
                          onClick={() => publish(p.id)}
                        >
                          {t('policies.publish')}
                        </button>
                      )}
                      {canManage && p.state === 'published' && (
                        <button
                          type="button"
                          className="btn btn-sm btn-ghost"
                          onClick={() => suspend(p.id)}
                        >
                          {t('policies.suspend')}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
