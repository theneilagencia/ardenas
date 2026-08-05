import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/ui/PageHeader';
import { useScopedData, usePermission } from '@/hooks/use-session';
import { useOperations } from '@/hooks/use-operations';
import { useAppStore } from '@/store/app-store';
import type { ApprovalState, Criticality } from '@/domain/types';

const CRIT_LABEL: Record<Criticality, string> = {
  low: 'risk.levelLow',
  moderate: 'risk.levelModerate',
  elevated: 'risk.levelElevated',
  critical: 'risk.levelCritical',
};

const CRIT_COLOR: Record<Criticality, string> = {
  low: 'var(--st-completed)',
  moderate: 'var(--st-waiting)',
  elevated: 'var(--st-working)',
  critical: 'var(--st-failed)',
};

const RESOLVED_KEY: Partial<Record<ApprovalState, string>> = {
  approved: 'approvals.stateApproved',
  rejected: 'approvals.stateRejected',
  changes_requested: 'approvals.stateChanges_requested',
  delegated: 'approvals.stateDelegated',
};

export function ApprovalsPage() {
  const { t } = useTranslation();
  const { approvals, people } = useScopedData();
  const { operations } = useOperations();
  const can = usePermission();
  const resolve = useAppStore((s) => s.resolveApproval);
  const canResolve = can('approval.resolve');

  const opName = (id: string) => operations.find((o) => o.id === id)?.name ?? id;
  const pending = approvals.filter((a) => a.state === 'pending');
  const resolved = approvals.filter((a) => a.state !== 'pending');

  const [selectedId, setSelectedId] = useState<string | null>(pending[0]?.id ?? null);
  const [delegateTo, setDelegateTo] = useState('');
  const [toast, setToast] = useState(false);

  useEffect(() => {
    if (!pending.some((a) => a.id === selectedId)) {
      setSelectedId(pending[0]?.id ?? null);
    }
  }, [pending, selectedId]);

  const selected = approvals.find((a) => a.id === selectedId) ?? null;

  const act = (decision: ApprovalState, justification?: string) => {
    if (!selected) return;
    resolve(selected.id, decision, justification);
    setToast(true);
    setDelegateTo('');
    window.setTimeout(() => setToast(false), 2500);
  };

  return (
    <>
      <PageHeader
        title={t('approvals.title')}
        subtitle={t('approvals.summary', { pending: pending.length, resolved: resolved.length })}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 360px) 1fr', gap: 'var(--sp-4)', alignItems: 'start' }}>
        {/* Lista mestre */}
        <div className="card" style={{ padding: 'var(--sp-3)' }}>
          <div className="t-micro" style={{ padding: '4px 8px 8px' }}>
            {t('approvals.pending')} · {pending.length}
          </div>
          <div className="stack" style={{ gap: 6 }}>
            {pending.length === 0 && <div className="empty-state">{t('common.empty')}</div>}
            {pending.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => setSelectedId(a.id)}
                className="card"
                style={{
                  padding: 'var(--sp-3)',
                  textAlign: 'left',
                  cursor: 'pointer',
                  background: a.id === selectedId ? 'var(--mut)' : 'var(--bg)',
                  boxShadow: a.id === selectedId ? 'inset 2px 0 0 var(--ac)' : 'none',
                }}
              >
                <strong style={{ fontSize: '0.875rem' }}>{a.title ?? opName(a.operationId)}</strong>
                <div className="t-micro" style={{ textTransform: 'none', letterSpacing: 0, marginTop: 2 }}>
                  {a.operationLabel ?? opName(a.operationId)}
                  {a.category ? ` · ${a.category}` : ''}
                </div>
                {a.due && (
                  <div className="mono" style={{ color: 'var(--tx2)', fontSize: '0.75rem', marginTop: 4 }}>
                    {a.due}
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Painel de detalhe */}
        <div className="card">
          {!selected ? (
            <div className="empty-state">{t('approvals.selectDecision')}</div>
          ) : (
            <>
              <div className="card-head">
                <h2 className="t-section">{selected.title ?? opName(selected.operationId)}</h2>
                {selected.criticality && (
                  <span className="badge">
                    <span
                      className="state-dot"
                      style={{ background: CRIT_COLOR[selected.criticality] }}
                      aria-hidden
                    />
                    {t(CRIT_LABEL[selected.criticality])}
                  </span>
                )}
              </div>

              <div className="grid-tiles" style={{ marginBottom: 'var(--sp-4)' }}>
                {selected.proposedAction && <Field label={t('approvals.proposedAction')} value={selected.proposedAction} />}
                {selected.recipients && <Field label={t('approvals.recipients')} value={selected.recipients} />}
                <Field label={t('approvals.operation')} value={selected.operationLabel ?? opName(selected.operationId)} />
                {selected.authorityLevel && <Field label={t('approvals.authority')} value={selected.authorityLevel} mono />}
                {selected.requestedBy && <Field label={t('approvals.requestedBy')} value={selected.requestedBy} />}
                {selected.impact && <Field label={t('approvals.impact')} value={selected.impact} />}
              </div>

              {selected.content && (
                <div style={{ marginBottom: 'var(--sp-4)' }}>
                  <div className="t-micro">{t('approvals.contentPrepared')}</div>
                  <pre
                    style={{
                      whiteSpace: 'pre-wrap',
                      fontFamily: 'inherit',
                      background: 'var(--bg)',
                      border: '1px solid var(--bd)',
                      borderRadius: 'var(--r-control)',
                      padding: 'var(--sp-3)',
                      marginTop: 6,
                    }}
                  >
                    {selected.content}
                  </pre>
                </div>
              )}

              {selected.evidenceLabels && selected.evidenceLabels.length > 0 && (
                <div style={{ marginBottom: 'var(--sp-4)' }}>
                  <div className="t-micro">{t('approvals.evidenceLinked')}</div>
                  <ul style={{ listStyle: 'none', padding: 0, marginTop: 6 }} className="stack">
                    {selected.evidenceLabels.map((e) => (
                      <li key={e} className="chip" style={{ width: 'fit-content' }}>
                        {e}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {canResolve && (
                <div className="stack" style={{ gap: 'var(--sp-3)' }}>
                  <div className="row">
                    <button type="button" className="btn btn-primary" onClick={() => act('approved')}>
                      {t('approvals.approveExecute')}
                    </button>
                    <button type="button" className="btn btn-ghost" onClick={() => act('changes_requested')}>
                      {t('approvals.requestAdjust')}
                    </button>
                    <button type="button" className="btn btn-ghost" onClick={() => act('rejected')}>
                      {t('approvals.reject')}
                    </button>
                  </div>
                  <div className="row" style={{ gap: 8 }}>
                    <select
                      value={delegateTo}
                      onChange={(e) => setDelegateTo(e.target.value)}
                      className="btn btn-ghost btn-sm"
                      aria-label={t('approvals.delegateTo')}
                    >
                      <option value="">{t('approvals.delegateTo')}</option>
                      {people.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      disabled={!delegateTo}
                      onClick={() => act('delegated', `Delegado para ${people.find((p) => p.id === delegateTo)?.name}`)}
                    >
                      {t('approvals.delegate')}
                    </button>
                  </div>
                  {toast && <p style={{ color: 'var(--st-completed)' }}>{t('approvals.resolvedToast')}</p>}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <div className="card" style={{ marginTop: 'var(--sp-4)' }}>
        <h2 className="t-section" style={{ marginBottom: 'var(--sp-3)' }}>
          {t('approvals.resolved')} ({resolved.length})
        </h2>
        {resolved.length === 0 ? (
          <div className="empty-state">{t('common.empty')}</div>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('operations.title')}</th>
                  <th>{t('common.status')}</th>
                </tr>
              </thead>
              <tbody>
                {resolved.map((a) => (
                  <tr key={a.id}>
                    <td>{a.title ?? opName(a.operationId)}</td>
                    <td>{t(RESOLVED_KEY[a.state] ?? 'common.status')}</td>
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

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="t-micro">{label}</div>
      <div className={mono ? 'mono' : ''} style={{ marginTop: 4, fontSize: '0.8125rem' }}>
        {value}
      </div>
    </div>
  );
}
