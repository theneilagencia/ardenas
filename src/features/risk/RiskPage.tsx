import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/ui/PageHeader';
import { useScopedData } from '@/hooks/use-session';
import type { RiskLevel } from '@/domain/types';

const IMPACT_COLOR: Record<RiskLevel, string> = {
  low: 'var(--st-completed)',
  moderate: 'var(--st-waiting)',
  elevated: 'var(--st-working)',
  critical: 'var(--st-failed)',
};

export function RiskPage() {
  const { t } = useTranslation();
  const { risks, integrations } = useScopedData();

  const sysName = (id?: string) => integrations.find((i) => i.id === id)?.name ?? '—';

  return (
    <>
      <PageHeader title={t('risk.title')} subtitle={t('risk.subtitle')} />
      <div className="card">
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('risk.action')}</th>
                <th>{t('risk.dataAccessed')}</th>
                <th>{t('risk.system')}</th>
                <th>{t('risk.consequence')}</th>
                <th>{t('risk.reversibility')}</th>
                <th>{t('risk.gradient')}</th>
                <th>{t('risk.impact')}</th>
              </tr>
            </thead>
            <tbody>
              {risks.map((r) => (
                <tr key={r.id}>
                  <td>
                    <strong>{r.actionName}</strong>
                  </td>
                  <td>{r.dataAccessed}</td>
                  <td>{sysName(r.integrationId)}</td>
                  <td>{r.consequence}</td>
                  <td>{t(`risk.${r.reversibility}`)}</td>
                  <td>
                    <code className="mono">{r.authorityLevel}</code>
                  </td>
                  <td>
                    {/* Classificação sempre em texto ao lado da cor. */}
                    <span className="badge">
                      <span
                        className="state-dot"
                        style={{ background: IMPACT_COLOR[r.impact] }}
                        aria-hidden
                      />
                      {t(`risk.level${r.impact.charAt(0).toUpperCase()}${r.impact.slice(1)}`)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
