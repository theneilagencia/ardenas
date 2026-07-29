import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/ui/PageHeader';
import { useScopedData, usePermission } from '@/hooks/use-session';
import { useAppStore } from '@/store/app-store';
import type { PolicyLevel, PolicyState } from '@/domain/types';

const STATE_KEY: Record<PolicyState, string> = {
  draft: 'policies.stateDraft',
  submitted: 'policies.stateSubmitted',
  approved: 'policies.stateApproved',
  published: 'policies.statePublished',
  suspended: 'policies.stateSuspended',
};

const LEVEL_ORDER: Record<PolicyLevel, number> = {
  corporate: 0,
  company: 1,
  area: 2,
  local_exception: 3,
};

type Tab = 'policies' | 'inheritance' | 'versions' | 'retention';

export function GovernancePage() {
  const { t } = useTranslation();
  const { policies } = useScopedData();
  const can = usePermission();
  const create = useAppStore((s) => s.createPolicy);
  const submit = useAppStore((s) => s.submitPolicy);
  const publish = useAppStore((s) => s.publishPolicy);
  const suspend = useAppStore((s) => s.suspendPolicy);
  const canManage = can('policy.manage');
  const canPublish = can('policy.publish');
  const [tab, setTab] = useState<Tab>('policies');

  const sorted = [...policies].sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level]);

  const TABS: Array<{ key: Tab; labelKey: string }> = [
    { key: 'policies', labelKey: 'governance.tabPolicies' },
    { key: 'inheritance', labelKey: 'governance.tabInheritance' },
    { key: 'versions', labelKey: 'governance.tabVersions' },
    { key: 'retention', labelKey: 'governance.tabRetention' },
  ];

  return (
    <>
      <PageHeader
        title={t('governance.title')}
        subtitle={t('governance.subtitle')}
        actions={
          canManage && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => create({ name: t('governance.newPolicy'), level: 'area' })}
            >
              {t('governance.newPolicy')}
            </button>
          )
        }
      />

      <div className="row" style={{ marginBottom: 'var(--sp-4)' }} role="tablist">
        {TABS.map((tb) => (
          <button
            key={tb.key}
            type="button"
            role="tab"
            aria-selected={tab === tb.key}
            className={`btn btn-sm${tab === tb.key ? ' btn-primary' : ' btn-ghost'}`}
            onClick={() => setTab(tb.key)}
          >
            {t(tb.labelKey)}
          </button>
        ))}
      </div>

      {tab === 'policies' && (
        <div className="card">
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('governance.colPolicy')}</th>
                  <th>{t('governance.colScope')}</th>
                  <th>{t('governance.colOwner')}</th>
                  <th className="mono">{t('governance.colVersion')}</th>
                  <th>{t('governance.colState')}</th>
                  <th className="mono">{t('governance.colOps')}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <strong>{p.name}</strong>
                      {p.updatedAt && (
                        <div className="t-micro" style={{ textTransform: 'none', letterSpacing: 0 }}>
                          {t('governance.updatedAt', { date: p.updatedAt })}
                        </div>
                      )}
                    </td>
                    <td>{p.scopeLabel ?? p.level}</td>
                    <td>{p.ownerName ?? '—'}</td>
                    <td className="mono">{p.version ?? '—'}</td>
                    <td>
                      <span className="badge">{t(STATE_KEY[p.state])}</span>
                    </td>
                    <td className="mono">{p.opsCount ?? 0}</td>
                    <td>
                      <div className="row">
                        {canManage && p.state === 'draft' && (
                          <button type="button" className="btn btn-sm btn-ghost" onClick={() => submit(p.id)}>
                            {t('policies.submit')}
                          </button>
                        )}
                        {canPublish && (p.state === 'submitted' || p.state === 'approved') && (
                          <button type="button" className="btn btn-sm btn-primary" onClick={() => publish(p.id)}>
                            {t('policies.publish')}
                          </button>
                        )}
                        {canManage && p.state === 'published' && (
                          <button type="button" className="btn btn-sm btn-ghost" onClick={() => suspend(p.id)}>
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
      )}

      {tab === 'inheritance' && (
        <div className="card">
          <p style={{ color: 'var(--tx2)', marginBottom: 'var(--sp-4)' }}>
            {t('governance.inheritanceNote')}
          </p>
          <div className="stack" style={{ gap: 8 }}>
            {(['corporate', 'company', 'area', 'local_exception'] as PolicyLevel[]).map((lvl, i) => (
              <div
                key={lvl}
                className="row"
                style={{
                  border: '1px solid var(--bd)',
                  borderRadius: 'var(--r-control)',
                  padding: 'var(--sp-3)',
                  marginLeft: i * 16,
                }}
              >
                <span className="chip mono">{i + 1}</span>
                {t(`policies.level${lvl.charAt(0).toUpperCase()}${lvl.slice(1)}` as never)}
                <span className="t-micro">
                  {policies.filter((p) => p.level === lvl).length} políticas
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'versions' && (
        <div className="card">
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('governance.colPolicy')}</th>
                  <th className="mono">{t('governance.colVersion')}</th>
                  <th>{t('governance.colOwner')}</th>
                  <th>{t('governance.colState')}</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((p) => (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td className="mono">{p.version ?? '—'}</td>
                    <td>{p.ownerName ?? '—'}</td>
                    <td>{t(STATE_KEY[p.state])}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'retention' && (
        <div className="empty-state">{t('placeholder.note')}</div>
      )}
    </>
  );
}
