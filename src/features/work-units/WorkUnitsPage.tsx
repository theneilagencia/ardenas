import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/ui/PageHeader';
import { useScopedData, usePermission } from '@/hooks/use-session';
import { useAppStore } from '@/store/app-store';

export function WorkUnitsPage() {
  const { t, i18n } = useTranslation();
  const { workUnits } = useScopedData();
  const requests = useAppStore((s) => s.data.workUnitRequests);
  const can = usePermission();
  const request = useAppStore((s) => s.requestWorkUnits);
  const approve = useAppStore((s) => s.approveWorkUnitRequest);

  const canRequest = can('budget.manage');
  const canApprove = can('budget.overage.approve');
  const ledger = workUnits[0];

  const [amount, setAmount] = useState(100);
  const [justification, setJustification] = useState('');

  const nf = (v: number) => new Intl.NumberFormat(i18n.language).format(v);
  const usageRatio = ledger ? ledger.used / ledger.contracted : 0;

  return (
    <>
      <PageHeader title={t('workUnits.title')} subtitle={t('workUnits.subtitle')} />

      {usageRatio >= 0.85 && (
        <p style={{ color: 'var(--st-waiting)', marginBottom: 'var(--sp-4)' }}>
          {t('workUnits.alert85')}
        </p>
      )}

      {ledger && (
        <div className="grid-tiles" style={{ marginBottom: 'var(--sp-5)' }}>
          <Tile label={t('workUnits.contracted')} value={nf(ledger.contracted)} />
          <Tile label={t('workUnits.used')} value={nf(ledger.used)} />
          <Tile label={t('workUnits.reserved')} value={nf(ledger.reserved)} />
          <Tile label={t('workUnits.projected')} value={nf(ledger.projected)} />
          <Tile label={t('workUnits.available')} value={nf(ledger.available)} />
          <Tile label={t('workUnits.overage')} value={nf(ledger.overage)} />
        </div>
      )}

      {canRequest && ledger && (
        <div className="card" style={{ marginBottom: 'var(--sp-4)' }}>
          <h2 className="t-section" style={{ marginBottom: 'var(--sp-3)' }}>
            {t('workUnits.request')}
          </h2>
          <div className="row" style={{ alignItems: 'flex-end', gap: 'var(--sp-3)' }}>
            <div className="field" style={{ margin: 0, minWidth: 140 }}>
              <label htmlFor="wu-amount">{t('workUnits.amount')}</label>
              <input
                id="wu-amount"
                type="number"
                min={1}
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
              />
            </div>
            <div className="field" style={{ margin: 0, flex: 1, minWidth: 200 }}>
              <label htmlFor="wu-just">{t('workUnits.justification')}</label>
              <input
                id="wu-just"
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
              />
            </div>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!justification.trim() || amount <= 0}
              onClick={() => {
                request({ areaId: ledger.areaId, amount, justification: justification.trim() });
                setJustification('');
              }}
            >
              {t('workUnits.request')}
            </button>
          </div>
        </div>
      )}

      <div className="card">
        <h2 className="t-section" style={{ marginBottom: 'var(--sp-3)' }}>
          {t('workUnits.requests')} ({requests.length})
        </h2>
        {requests.length === 0 ? (
          <div className="empty-state">{t('common.empty')}</div>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="mono">{t('workUnits.amount')}</th>
                  <th>{t('workUnits.justification')}</th>
                  <th>{t('common.status')}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {requests.map((r) => (
                  <tr key={r.id}>
                    <td className="mono">{nf(r.amount)}</td>
                    <td>{r.justification}</td>
                    <td>
                      <code className="mono">{r.state}</code>
                    </td>
                    <td>
                      {canApprove && r.state === 'pending' && (
                        <button
                          type="button"
                          className="btn btn-sm btn-primary"
                          onClick={() => approve(r.id)}
                        >
                          {t('workUnits.approve')}
                        </button>
                      )}
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

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric-tile">
      <span className="t-micro">{label}</span>
      <span className="t-metric">{value}</span>
    </div>
  );
}
