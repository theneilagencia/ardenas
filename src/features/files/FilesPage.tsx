import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/ui/PageHeader';
import { useScopedData, usePermission } from '@/hooks/use-session';
import { useAppStore } from '@/store/app-store';
import { formatBytes } from '@/lib/format';
import type { FileState } from '@/domain/types';

const STATE_KEY: Record<FileState, string> = {
  active: 'files.stateActive',
  quarantined: 'files.stateQuarantined',
  deletion_requested: 'files.stateDeletionRequested',
  deleted: 'files.stateDeleted',
};

export function FilesPage() {
  const { t } = useTranslation();
  const { files, operations, people } = useScopedData();
  const can = usePermission();
  const quarantine = useAppStore((s) => s.quarantineFile);
  const restore = useAppStore((s) => s.restoreFile);
  const requestDeletion = useAppStore((s) => s.requestFileDeletion);
  const approveDeletion = useAppStore((s) => s.approveFileDeletion);
  const [approver, setApprover] = useState<Record<string, string>>({});

  const opName = (id?: string) => operations.find((o) => o.id === id)?.name;

  return (
    <>
      <PageHeader title={t('files.title')} subtitle={t('files.recoveryNote')} />

      <div className="card">
        <h2 className="t-section" style={{ marginBottom: 'var(--sp-4)' }}>
          {t('files.candidates')}
        </h2>
        <div className="stack">
          {files.map((f) => {
            // Arquivo crítico vinculado a operação ativa não pode ser movido — o botão não existe.
            const activeLink = f.linkedOperationId
              ? operations.find((o) => o.id === f.linkedOperationId && o.status !== 'archived')
              : undefined;
            const lockedCritical = f.critical && !!activeLink;
            const approversCount = new Set(f.deletionApprovers).size;

            return (
              <div
                key={f.id}
                className="card"
                data-testid={`file-${f.id}`}
                style={{ background: 'var(--bg)' }}
              >
                <div className="card-head">
                  <div>
                    <strong>{f.name}</strong>
                    {f.critical && (
                      <span
                        className="chip"
                        style={{ marginLeft: 8, color: 'var(--st-failed)' }}
                      >
                        {t('files.critical')}
                      </span>
                    )}
                    <div style={{ color: 'var(--tx2)', marginTop: 2 }}>{f.repository}</div>
                  </div>
                  <span className="badge">{t(STATE_KEY[f.state])}</span>
                </div>

                <div className="grid-tiles" style={{ marginBottom: 'var(--sp-3)' }}>
                  <Info label={t('files.criterion')} value={f.criterion} />
                  <Info label={t('files.size')} value={formatBytes(f.sizeBytes)} />
                  <Info label={t('files.age')} value={t('files.days', { count: f.ageDays })} />
                  <Info
                    label={t('files.link')}
                    value={
                      f.linkedOperationId
                        ? t('files.linkedTo', { name: opName(f.linkedOperationId) ?? f.linkedOperationId })
                        : t('files.unlinked')
                    }
                  />
                </div>

                {lockedCritical ? (
                  <p style={{ color: 'var(--st-failed)' }}>{t('files.criticalLocked')}</p>
                ) : (
                  <div className="row">
                    {f.state === 'active' && can('file.quarantine') && (
                      <button
                        type="button"
                        className="btn btn-sm btn-ghost"
                        onClick={() => quarantine(f.id)}
                        data-testid={`quarantine-${f.id}`}
                      >
                        {t('files.quarantine')}
                      </button>
                    )}
                    {f.state === 'quarantined' && can('file.restore') && (
                      <button
                        type="button"
                        className="btn btn-sm btn-ghost"
                        onClick={() => restore(f.id)}
                      >
                        {t('files.restore')}
                      </button>
                    )}

                    {/* Exclusão definitiva existe apenas como solicitação, exigindo dois aprovadores. */}
                    {(f.state === 'quarantined' || f.state === 'deletion_requested') && (
                      <div
                        className="row"
                        style={{ gap: 6, borderLeft: '1px solid var(--bd)', paddingLeft: 10 }}
                      >
                        {f.state === 'quarantined' && can('file.delete.request') && (
                          <>
                            <select
                              className="btn btn-sm btn-ghost"
                              value={approver[f.id] ?? ''}
                              onChange={(e) =>
                                setApprover((prev) => ({ ...prev, [f.id]: e.target.value }))
                              }
                              aria-label={t('files.selectApprover')}
                            >
                              <option value="">{t('files.selectApprover')}</option>
                              {people.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              className="btn btn-sm btn-ghost"
                              disabled={!approver[f.id]}
                              onClick={() => requestDeletion(f.id, approver[f.id])}
                            >
                              {t('files.requestDeletion')}
                            </button>
                          </>
                        )}

                        {f.state === 'deletion_requested' && (
                          <>
                            <span className="chip">
                              {t('files.approversSoFar', { count: approversCount })}
                            </span>
                            {can('file.delete.approve') && (
                              <>
                                <select
                                  className="btn btn-sm btn-ghost"
                                  value={approver[f.id] ?? ''}
                                  onChange={(e) =>
                                    setApprover((prev) => ({ ...prev, [f.id]: e.target.value }))
                                  }
                                  aria-label={t('files.selectApprover')}
                                >
                                  <option value="">{t('files.selectApprover')}</option>
                                  {people
                                    .filter((p) => !f.deletionApprovers.includes(p.id))
                                    .map((p) => (
                                      <option key={p.id} value={p.id}>
                                        {p.name}
                                      </option>
                                    ))}
                                </select>
                                <button
                                  type="button"
                                  className="btn btn-sm btn-primary"
                                  disabled={!approver[f.id]}
                                  onClick={() => approveDeletion(f.id, approver[f.id])}
                                >
                                  {t('files.approveDeletion')}
                                </button>
                              </>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}
                {(f.state === 'quarantined' || f.state === 'deletion_requested') && (
                  <p style={{ color: 'var(--tx2)', marginTop: 8, fontSize: '0.8125rem' }}>
                    {t('files.deletionNeedsTwo')}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="t-micro">{label}</div>
      <div style={{ marginTop: 4, fontSize: '0.8125rem' }}>{value}</div>
    </div>
  );
}
