import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';

/** As 12 etapas do avaliador de operação autônoma (do mockup). */
const STEPS = [
  'who',
  'work',
  'sources',
  'actions',
  'systems',
  'authority',
  'risk',
  'controls',
  'executability',
  'capacity',
  'baseline',
  'recommendation',
] as const;

export function EvaluatorPage() {
  const { t } = useTranslation();
  const [current, setCurrent] = useState(0);
  const [who, setWho] = useState({ name: '', company: '', role: '' });

  const stepKey = STEPS[current];
  const isLast = current === STEPS.length - 1;

  return (
    <>
      <PageHeader title={t('evaluator.title')} subtitle={t('evaluator.subtitle')} />

      {/* Trilho numerado 1..12 */}
      <div
        className="row"
        style={{ gap: 6, marginBottom: 'var(--sp-5)', overflowX: 'auto', paddingBottom: 4 }}
        role="tablist"
      >
        {STEPS.map((key, i) => {
          const done = i < current;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={i === current}
              className={`btn btn-sm${i === current ? ' btn-primary' : ' btn-ghost'}`}
              onClick={() => setCurrent(i)}
              style={{ flex: 'none', minWidth: 36 }}
              title={t(`evaluator.steps.${key}`)}
            >
              {done ? <Check size={13} aria-hidden /> : <span className="mono">{i + 1}</span>}
            </button>
          );
        })}
      </div>

      <div className="card">
        <div className="t-micro" style={{ marginBottom: 6 }}>
          {t('evaluator.stepOf', { current: current + 1, total: STEPS.length })}
        </div>
        <h2 className="t-section" style={{ marginBottom: 'var(--sp-3)' }}>
          {t(`evaluator.steps.${stepKey}`)}
        </h2>

        {stepKey === 'who' ? (
          <>
            <p style={{ color: 'var(--tx2)', marginBottom: 'var(--sp-4)' }}>
              {t('evaluator.whoIntro')}
            </p>
            <div className="field">
              <label htmlFor="ev-name">{t('evaluator.fieldName')}</label>
              <input
                id="ev-name"
                value={who.name}
                onChange={(e) => setWho({ ...who, name: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="ev-company">{t('evaluator.fieldCompany')}</label>
              <input
                id="ev-company"
                value={who.company}
                onChange={(e) => setWho({ ...who, company: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="ev-role">{t('evaluator.fieldRole')}</label>
              <input
                id="ev-role"
                value={who.role}
                onChange={(e) => setWho({ ...who, role: e.target.value })}
              />
            </div>
          </>
        ) : stepKey === 'recommendation' ? (
          <div className="stack">
            <div className="t-micro">{t('evaluator.recommendation')}</div>
            <p className="t-section" style={{ color: 'var(--st-completed)' }}>
              Forte candidata
            </p>
            <p style={{ color: 'var(--tx2)' }}>{t('evaluator.genericNote')}</p>
          </div>
        ) : (
          <p style={{ color: 'var(--tx2)' }}>{t('evaluator.genericNote')}</p>
        )}

        <div className="row" style={{ marginTop: 'var(--sp-5)', justifyContent: 'space-between' }}>
          <button
            type="button"
            className="btn btn-ghost"
            disabled={current === 0}
            onClick={() => setCurrent((c) => Math.max(0, c - 1))}
          >
            {t('evaluator.back')}
          </button>
          {isLast ? (
            <div className="row">
              <button type="button" className="btn btn-ghost" onClick={() => setCurrent(0)}>
                {t('evaluator.restart')}
              </button>
              <button type="button" className="btn btn-primary">
                {t('evaluator.export')}
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setCurrent((c) => Math.min(STEPS.length - 1, c + 1))}
            >
              {t('evaluator.continue')}
            </button>
          )}
        </div>
      </div>
    </>
  );
}
