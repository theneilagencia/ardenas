/**
 * Arden.AS — telas de estado de sessão (ARDEN-FE-002).
 * Comportamento visual claro e DISTINTO por estado: nada é redirecionado
 * silenciosamente para o Dashboard. Preserva a identidade visual existente.
 */

import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';

export function SessionCenter({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        display: 'grid',
        placeItems: 'center',
        minHeight: '100vh',
        padding: 'var(--sp-5)',
        background: 'var(--bg)',
      }}
    >
      <div className="card" style={{ maxWidth: 480, width: '100%', textAlign: 'center' }}>
        {children}
      </div>
    </div>
  );
}

export function SessionLoading() {
  const { t } = useTranslation();
  return (
    <SessionCenter>
      <div className="row" style={{ justifyContent: 'center', gap: 8 }}>
        <Loader2 size={16} className="spin" aria-hidden />
        <span style={{ color: 'var(--tx2)' }}>{t('session.loading')}</span>
      </div>
    </SessionCenter>
  );
}

interface StateScreenProps {
  titleKey: string;
  bodyKey: string;
  tone?: 'neutral' | 'warning' | 'danger';
  action?: { labelKey: string; onClick: () => void };
  secondary?: { labelKey: string; onClick: () => void };
}

export function SessionStateScreen({
  titleKey,
  bodyKey,
  tone = 'neutral',
  action,
  secondary,
}: StateScreenProps) {
  const { t } = useTranslation();
  const color =
    tone === 'danger' ? 'var(--st-failed)' : tone === 'warning' ? 'var(--st-waiting)' : 'var(--tx)';
  return (
    <SessionCenter>
      <h1 className="t-section" style={{ color, marginBottom: 'var(--sp-3)' }} data-testid="session-state-title">
        {t(titleKey)}
      </h1>
      <p style={{ color: 'var(--tx2)', marginBottom: 'var(--sp-4)' }}>{t(bodyKey)}</p>
      <div className="row" style={{ justifyContent: 'center', gap: 8 }}>
        {action && (
          <button type="button" className="btn btn-primary" onClick={action.onClick}>
            {t(action.labelKey)}
          </button>
        )}
        {secondary && (
          <button type="button" className="btn btn-ghost" onClick={secondary.onClick}>
            {t(secondary.labelKey)}
          </button>
        )}
      </div>
    </SessionCenter>
  );
}
