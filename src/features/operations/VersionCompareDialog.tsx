import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { OperationVersionEntry } from '@/domain/types';

export function VersionCompareDialog({
  versions,
  open,
  onOpenChange,
}: {
  versions: OperationVersionEntry[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const last = versions.length - 1;
  const [aIdx, setAIdx] = useState(Math.max(0, last - 1));
  const [bIdx, setBIdx] = useState(last);

  const a = versions[aIdx];
  const b = versions[bIdx];

  const rows: Array<{ label: string; a: string; b: string }> = a && b
    ? [
        { label: t('common.version'), a: `v${a.version}`, b: `v${b.version}` },
        { label: t('operations.environment'), a: a.environment ?? '—', b: b.environment ?? '—' },
        { label: t('common.status'), a: t(`opStatus.${a.status}`), b: t(`opStatus.${b.status}`) },
        { label: t('wizard.field.budget'), a: `R$ ${a.budget.toLocaleString('pt-BR')}`, b: `R$ ${b.budget.toLocaleString('pt-BR')}` },
        { label: 'Work Units', a: String(a.workUnits), b: String(b.workUnits) },
        { label: t('operations.publishedAt'), a: a.publishedAt?.slice(0, 10) ?? '—', b: b.publishedAt?.slice(0, 10) ?? '—' },
        { label: t('operations.note'), a: a.note, b: b.note },
      ]
    : [];

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog-content" style={{ width: 'min(720px, calc(100vw - 32px))' }}>
          <div className="card-head">
            <Dialog.Title asChild>
              <h2 className="t-section">{t('operations.compareTitle')}</h2>
            </Dialog.Title>
            <Dialog.Close asChild>
              <button type="button" className="icon-btn" aria-label={t('common.cancel')}>
                <X size={15} aria-hidden />
              </button>
            </Dialog.Close>
          </div>

          <div className="row" style={{ gap: 'var(--sp-3)', marginBottom: 'var(--sp-4)' }}>
            <label className="field" style={{ margin: 0, flex: 1 }}>
              <span className="t-micro">A</span>
              <select value={aIdx} onChange={(e) => setAIdx(Number(e.target.value))}>
                {versions.map((v, i) => (
                  <option key={v.version} value={i}>
                    v{v.version}
                  </option>
                ))}
              </select>
            </label>
            <label className="field" style={{ margin: 0, flex: 1 }}>
              <span className="t-micro">B</span>
              <select value={bIdx} onChange={(e) => setBIdx(Number(e.target.value))}>
                {versions.map((v, i) => (
                  <option key={v.version} value={i}>
                    v{v.version}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="table-scroll">
            <table className="data-table">
              <tbody>
                {rows.map((r) => {
                  const diff = r.a !== r.b;
                  return (
                    <tr key={r.label}>
                      <th style={{ textAlign: 'left', width: 160 }}>{r.label}</th>
                      <td style={{ background: diff ? 'var(--mut)' : undefined }}>{r.a}</td>
                      <td style={{ background: diff ? 'var(--mut)' : undefined }}>
                        {r.b}
                        {diff && (
                          <span
                            className="state-dot"
                            style={{ background: 'var(--ac)', marginLeft: 8, display: 'inline-block' }}
                            aria-hidden
                          />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="t-micro" style={{ marginTop: 'var(--sp-3)', textTransform: 'none', letterSpacing: 0 }}>
            {t('operations.diffLegend')}
          </p>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
