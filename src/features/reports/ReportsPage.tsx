import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/ui/PageHeader';
import { useScopedData } from '@/hooks/use-session';
import { useAppStore } from '@/store/app-store';
import { formatCurrency } from '@/lib/format';
import type { Lang } from '@/i18n';

const REPORTS = [
  { id: 'rep_consumption', labelKey: 'reports.consumption' },
] as const;

export function ReportsPage() {
  const { t, i18n } = useTranslation();
  const { budgets } = useScopedData();
  const exportReport = useAppStore((s) => s.exportReport);
  const [exported, setExported] = useState<string | null>(null);
  const lang = i18n.language as Lang;

  const totalSpent = budgets.reduce((sum, b) => sum + b.spent, 0);
  const totalBudget = budgets.reduce((sum, b) => sum + b.total, 0);

  return (
    <>
      <PageHeader title={t('reports.title')} />
      <div className="grid-tiles" style={{ marginBottom: 'var(--sp-5)' }}>
        <div className="metric-tile">
          <span className="t-micro">{t('budget.spent')}</span>
          <span className="t-metric" style={{ fontSize: '1.1rem' }}>
            {formatCurrency(totalSpent, lang)}
          </span>
        </div>
        <div className="metric-tile">
          <span className="t-micro">{t('budget.total')}</span>
          <span className="t-metric" style={{ fontSize: '1.1rem' }}>
            {formatCurrency(totalBudget, lang)}
          </span>
        </div>
      </div>

      <div className="card">
        <div className="stack">
          {REPORTS.map((r) => (
            <div
              key={r.id}
              className="row"
              style={{
                justifyContent: 'space-between',
                border: '1px solid var(--bd)',
                borderRadius: 'var(--r-control)',
                padding: 'var(--sp-3)',
              }}
            >
              <strong>{t(r.labelKey)}</strong>
              <button
                type="button"
                className="btn btn-sm btn-primary"
                onClick={() => {
                  exportReport(r.id);
                  setExported(r.id);
                }}
              >
                {t('reports.export')}
              </button>
            </div>
          ))}
        </div>
        {exported && (
          <p style={{ color: 'var(--st-completed)', marginTop: 'var(--sp-3)' }}>
            {t('reports.exported')}
          </p>
        )}
      </div>
    </>
  );
}
