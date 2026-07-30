import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { useAppStore } from '@/store/app-store';

const STEPS = ['overview', 'nav', 'wizard', 'assistant', 'theme'] as const;

export function TourOverlay() {
  const { t } = useTranslation();
  const step = useAppStore((s) => s.tourStep);
  const next = useAppStore((s) => s.tourNext);
  const prev = useAppStore((s) => s.tourPrev);
  const end = useAppStore((s) => s.endTour);

  if (step < 0 || step >= STEPS.length) return null;
  const key = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t(`tour.steps.${key}.title`)}
      style={{ position: 'fixed', inset: 0, zIndex: 90 }}
    >
      <div
        style={{ position: 'absolute', inset: 0, background: 'rgb(17 17 17 / 45%)' }}
        onClick={end}
        aria-hidden
      />
      <div
        className="card"
        style={{
          position: 'absolute',
          bottom: 24,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 'min(460px, calc(100vw - 32px))',
          boxShadow: 'var(--shadow-overlay)',
          zIndex: 91,
        }}
      >
        <div className="card-head">
          <span className="t-micro">{t('tour.stepOf', { current: step + 1, total: STEPS.length })}</span>
          <button type="button" className="icon-btn" onClick={end} aria-label={t('tour.finish')}>
            <X size={15} aria-hidden />
          </button>
        </div>
        <h2 className="t-section" style={{ marginBottom: 8 }}>
          {t(`tour.steps.${key}.title`)}
        </h2>
        <p style={{ color: 'var(--tx2)' }}>{t(`tour.steps.${key}.body`)}</p>

        <div className="row" style={{ justifyContent: 'space-between', marginTop: 'var(--sp-5)' }}>
          <div className="row" style={{ gap: 6 }} aria-hidden>
            {STEPS.map((_, i) => (
              <span
                key={i}
                className="state-dot"
                style={{ background: i === step ? 'var(--ac)' : 'var(--bd)' }}
              />
            ))}
          </div>
          <div className="row">
            <button type="button" className="btn btn-ghost" disabled={step === 0} onClick={prev}>
              {t('tour.prev')}
            </button>
            {isLast ? (
              <button type="button" className="btn btn-primary" onClick={end}>
                {t('tour.finish')}
              </button>
            ) : (
              <button type="button" className="btn btn-primary" onClick={next}>
                {t('tour.next')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
