import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/ui/PageHeader';
import { useScopedData } from '@/hooks/use-session';
import type { ResultMethod } from '@/domain/types';

const METHOD_KEY: Record<ResultMethod, string> = {
  measured: 'results.methodMeasured',
  estimated: 'results.methodEstimated',
  client_reported: 'results.methodClient_reported',
  validated: 'results.methodValidated',
  unavailable: 'results.methodUnavailable',
};

const PERIODS = ['Julho 2026', 'Junho 2026', '2º trimestre', 'Últimos 12 meses'];

function deltaColor(delta: string): string {
  if (delta === '—' || delta === '') return 'var(--tx2)';
  // Reduções em custo/tempo/retrabalho/intervenções são positivas; o mockup usa
  // verde para melhoria. Aqui a melhoria é sinalizada pela seta, cor neutra/positiva.
  return delta.startsWith('-') ? 'var(--st-completed)' : 'var(--st-completed)';
}

export function ResultsPage() {
  const { t } = useTranslation();
  const { resultIndicators } = useScopedData();
  const [period, setPeriod] = useState(PERIODS[0]);

  return (
    <>
      <PageHeader title={t('results.title')} subtitle={t('results.subtitle')} />

      <div className="row" style={{ marginBottom: 'var(--sp-4)' }}>
        {PERIODS.map((p) => (
          <button
            key={p}
            type="button"
            className={`btn btn-sm${period === p ? ' btn-primary' : ' btn-ghost'}`}
            onClick={() => setPeriod(p)}
          >
            {p}
          </button>
        ))}
      </div>

      <p className="t-micro" style={{ marginBottom: 'var(--sp-4)' }}>
        {t('results.comparedTo', { period })}
      </p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
          gap: 'var(--sp-3)',
        }}
      >
        {resultIndicators.map((ind) => (
          <div key={ind.id} className="card" style={{ padding: 'var(--sp-4)' }}>
            <div className="row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontWeight: 500 }}>{ind.name}</span>
            </div>
            <span className="t-micro">{t(METHOD_KEY[ind.method])}</span>
            <div className="t-metric" style={{ marginTop: 8 }}>
              {ind.value}
            </div>
            <div className="row" style={{ justifyContent: 'space-between', marginTop: 6 }}>
              <span className="mono" style={{ color: deltaColor(ind.delta), fontSize: '0.8125rem' }}>
                {ind.delta}
              </span>
              <span className="t-micro" style={{ textTransform: 'none', letterSpacing: 0 }}>
                {t('results.before', { value: ind.before })}
              </span>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
