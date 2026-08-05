import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/ui/PageHeader';
import { useScopedData } from '@/hooks/use-session';
import type { AuthorityLevel, RiskLevel } from '@/domain/types';

const LEVELS: Array<{ level: AuthorityLevel; labelKey: string; descKey: string }> = [
  { level: 'observe', labelKey: 'authority.levelObserve', descKey: 'authority.descObserve' },
  { level: 'prepare', labelKey: 'authority.levelPrepare', descKey: 'authority.descPrepare' },
  { level: 'execute_under_rule', labelKey: 'authority.levelExecuteRule', descKey: 'authority.descExecuteRule' },
  { level: 'execute_with_approval', labelKey: 'authority.levelExecuteApproval', descKey: 'authority.descExecuteApproval' },
  { level: 'blocked', labelKey: 'authority.levelBlocked', descKey: 'authority.descBlocked' },
];

const RISK_COLOR: Record<RiskLevel, string> = {
  low: 'var(--st-completed)',
  moderate: 'var(--st-waiting)',
  elevated: 'var(--st-working)',
  critical: 'var(--st-failed)',
};

const RISK_KEY: Record<RiskLevel, string> = {
  low: 'risk.levelLow',
  moderate: 'risk.levelModerate',
  elevated: 'risk.levelElevated',
  critical: 'risk.levelCritical',
};

const AUTH_KEY: Record<AuthorityLevel, string> = {
  observe: 'authority.levelObserve',
  prepare: 'authority.levelPrepare',
  execute_under_rule: 'authority.levelExecuteRule',
  execute_with_approval: 'authority.levelExecuteApproval',
  blocked: 'authority.levelBlocked',
};

export function AuthorityPage() {
  const { t } = useTranslation();
  const { authorityMatrix } = useScopedData();

  const countFor = (level: AuthorityLevel) =>
    authorityMatrix.filter((r) => r.authorityLevel === level).length;

  return (
    <>
      <PageHeader title={t('authority.title')} subtitle={t('authority.subtitle')} />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 'var(--sp-3)',
          marginBottom: 'var(--sp-5)',
        }}
      >
        {LEVELS.map((l) => (
          <div key={l.level} className="card" style={{ padding: 'var(--sp-4)' }}>
            <div className="t-section" style={{ fontSize: '0.9375rem' }}>
              {t(l.labelKey)}
            </div>
            <p style={{ color: 'var(--tx2)', margin: '6px 0 10px', fontSize: '0.8125rem' }}>
              {t(l.descKey)}
            </p>
            <span className="chip mono">{t('authority.count', { count: countFor(l.level) })}</span>
          </div>
        ))}
      </div>

      <div className="card">
        <h2 className="t-section" style={{ marginBottom: 'var(--sp-3)' }}>
          {t('authority.matrixTitle')}
        </h2>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('authority.colAction')}</th>
                <th>{t('authority.colSystem')}</th>
                <th>{t('authority.colCondition')}</th>
                <th>{t('authority.colReversible')}</th>
                <th>{t('authority.colRisk')}</th>
                <th>{t('authority.colAuthority')}</th>
              </tr>
            </thead>
            <tbody>
              {authorityMatrix.map((r) => (
                <tr key={r.id}>
                  <td>
                    <strong>{r.action}</strong>
                  </td>
                  <td>{r.system}</td>
                  <td>{r.condition}</td>
                  <td>{r.reversible ? t('authority.yes') : t('authority.no')}</td>
                  <td>
                    <span className="badge">
                      <span
                        className="state-dot"
                        style={{ background: RISK_COLOR[r.risk] }}
                        aria-hidden
                      />
                      {t(RISK_KEY[r.risk])}
                    </span>
                  </td>
                  <td>{t(AUTH_KEY[r.authorityLevel])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
