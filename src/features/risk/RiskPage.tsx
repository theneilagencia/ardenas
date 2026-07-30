import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/ui/PageHeader';
import { Drawer, DrawerField } from '@/components/ui/Drawer';
import { useScopedData } from '@/hooks/use-session';
import type { Risk, RiskLevel } from '@/domain/types';

const IMPACT_COLOR: Record<RiskLevel, string> = {
  low: 'var(--st-completed)',
  moderate: 'var(--st-waiting)',
  elevated: 'var(--st-working)',
  critical: 'var(--st-failed)',
};

export function RiskPage() {
  const { t } = useTranslation();
  const { risks, integrations, people } = useScopedData();
  const [selected, setSelected] = useState<Risk | null>(null);

  const sysName = (id?: string) => integrations.find((i) => i.id === id)?.name ?? '—';
  const ownerName = (id: string) => people.find((p) => p.id === id)?.name ?? id;

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
                <tr
                  key={r.id}
                  className="clickable-row"
                  onClick={() => setSelected(r)}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelected(r);
                    }
                  }}
                >
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

      <Drawer
        open={selected !== null}
        onOpenChange={(o) => !o && setSelected(null)}
        title={selected?.actionName ?? ''}
      >
        {selected && (
          <>
            <DrawerField label={t('risk.dataAccessed')} value={selected.dataAccessed} />
            <DrawerField label={t('risk.system')} value={sysName(selected.integrationId)} />
            <DrawerField label={t('risk.consequence')} value={selected.consequence} />
            <DrawerField label={t('risk.reversibility')} value={t(`risk.${selected.reversibility}`)} />
            <DrawerField
              label={t('risk.gradient')}
              value={<code className="mono">{selected.authorityLevel}</code>}
            />
            <DrawerField
              label={t('risk.impact')}
              value={
                <span className="badge">
                  <span
                    className="state-dot"
                    style={{ background: IMPACT_COLOR[selected.impact] }}
                    aria-hidden
                  />
                  {t(`risk.level${selected.impact.charAt(0).toUpperCase()}${selected.impact.slice(1)}`)}
                </span>
              }
            />
            <DrawerField label={t('common.owner')} value={ownerName(selected.ownerId)} />
            <DrawerField label="Exposição" value={selected.exposure} />
            <DrawerField label="Mitigação" value={selected.mitigation} />
          </>
        )}
      </Drawer>
    </>
  );
}
