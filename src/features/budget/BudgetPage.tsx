import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/ui/PageHeader';
import { useScopedData, usePermission } from '@/hooks/use-session';
import { useAppStore } from '@/store/app-store';
import { formatCurrency } from '@/lib/format';
import type { Lang } from '@/i18n';

export function BudgetPage() {
  const { t, i18n } = useTranslation();
  const { budgets } = useScopedData();
  const can = usePermission();
  const setBudget = useAppStore((s) => s.setBudget);
  const canManage = can('budget.manage');
  const lang = i18n.language as Lang;

  const [editing, setEditing] = useState<string | null>(null);
  const [value, setValue] = useState(0);

  return (
    <>
      <PageHeader title={t('budget.title')} />
      <div className="stack">
        {budgets.map((b) => {
          const remaining = b.total - b.spent;
          const ratio = b.total > 0 ? Math.min(1, b.spent / b.total) : 0;
          return (
            <div key={b.id} className="card">
              <div className="card-head">
                <h2 className="t-section mono">{b.costCenterId}</h2>
                {canManage &&
                  (editing === b.id ? (
                    <div className="row">
                      <input
                        type="number"
                        value={value}
                        onChange={(e) => setValue(Number(e.target.value))}
                        style={{
                          width: 140,
                          padding: '6px 8px',
                          border: '1px solid var(--bd)',
                          borderRadius: 'var(--r-control)',
                          background: 'var(--bg)',
                          color: 'var(--tx)',
                        }}
                        aria-label={t('budget.total')}
                      />
                      <button
                        type="button"
                        className="btn btn-sm btn-primary"
                        onClick={() => {
                          setBudget(b.id, value);
                          setEditing(null);
                        }}
                      >
                        {t('budget.save')}
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-sm btn-ghost"
                      onClick={() => {
                        setEditing(b.id);
                        setValue(b.total);
                      }}
                    >
                      {t('budget.edit')}
                    </button>
                  ))}
              </div>

              <div className="grid-tiles" style={{ marginBottom: 'var(--sp-3)' }}>
                <Tile label={t('budget.total')} value={formatCurrency(b.total, lang)} />
                <Tile label={t('budget.spent')} value={formatCurrency(b.spent, lang)} />
                <Tile label={t('budget.remaining')} value={formatCurrency(remaining, lang)} />
              </div>

              <div
                style={{
                  height: 6,
                  borderRadius: 999,
                  background: 'var(--mut)',
                  overflow: 'hidden',
                }}
                aria-hidden
              >
                <div
                  style={{
                    width: `${ratio * 100}%`,
                    height: '100%',
                    background: ratio >= 0.85 ? 'var(--st-waiting)' : 'var(--st-working)',
                    transition: 'width var(--dur-progress) var(--ease)',
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric-tile">
      <span className="t-micro">{label}</span>
      <span className="t-metric" style={{ fontSize: '1.1rem' }}>
        {value}
      </span>
    </div>
  );
}
