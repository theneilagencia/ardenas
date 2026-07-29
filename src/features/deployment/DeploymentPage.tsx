import { useTranslation } from 'react-i18next';
import { Check, Lock } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { useScopedData } from '@/hooks/use-session';
import { useAppStore } from '@/store/app-store';

export function DeploymentPage() {
  const { t } = useTranslation();
  const { deployments } = useScopedData();
  const complete = useAppStore((s) => s.completeDeploymentStep);
  const redo = useAppStore((s) => s.redoDeploymentStep);

  const deployment = deployments[0];
  if (!deployment) return <div className="empty-state">{t('common.empty')}</div>;

  const doneCount = deployment.steps.filter((s) => s.done).length;

  return (
    <>
      <PageHeader
        title={t('deployment.title')}
        subtitle={t('deployment.subtitle')}
        actions={
          <span className="badge">
            {deployment.completed ? (
              <>
                <Check size={14} aria-hidden style={{ color: 'var(--st-completed)' }} />
                {t('deployment.finished')}
              </>
            ) : (
              t('deployment.progress', { done: doneCount, total: deployment.steps.length })
            )}
          </span>
        }
      />

      <div className="stack">
        {deployment.steps.map((step, idx) => {
          const priorDone = deployment.steps.slice(0, idx).every((s) => s.done);
          const locked = !step.done && !priorDone;
          return (
            <div
              key={step.id}
              className="card"
              data-testid={`deploy-step-${step.order}`}
              data-locked={locked}
              data-done={step.done}
              style={{
                opacity: locked ? 0.6 : 1,
                borderColor: step.done ? 'var(--st-completed)' : 'var(--bd)',
              }}
            >
              <div className="card-head">
                <div className="row">
                  <span
                    className="state-dot"
                    style={{
                      width: 22,
                      height: 22,
                      display: 'grid',
                      placeItems: 'center',
                      borderRadius: 999,
                      background: step.done ? 'var(--st-completed)' : 'var(--mut)',
                      color: step.done ? '#fff' : 'var(--tx2)',
                    }}
                    aria-hidden
                  >
                    {step.done ? <Check size={13} /> : locked ? <Lock size={12} /> : step.order}
                  </span>
                  <div>
                    <strong>
                      <span className="mono" style={{ marginRight: 8 }}>
                        {String(step.order).padStart(2, '0')}
                      </span>
                      {step.name}
                    </strong>
                    <div style={{ color: 'var(--tx2)' }}>{step.description}</div>
                  </div>
                </div>

                <div className="row">
                  {step.done ? (
                    <button
                      type="button"
                      className="btn btn-sm btn-ghost"
                      onClick={() => redo(deployment.id, step.id)}
                    >
                      {t('deployment.redo')}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-sm btn-primary"
                      disabled={locked}
                      onClick={() => complete(deployment.id, step.id)}
                      data-testid={`deploy-complete-${step.order}`}
                    >
                      {locked ? t('deployment.locked') : t('deployment.complete')}
                    </button>
                  )}
                </div>
              </div>

              <div className="grid-tiles">
                <Info label={t('deployment.owner')} value={step.ownerName} />
                <Info label={t('deployment.help')} value={step.help} />
                <Info label={t('deployment.expectedResult')} value={step.expectedResult} />
              </div>
            </div>
          );
        })}
      </div>

      {!deployment.completed && (
        <p style={{ color: 'var(--tx2)', marginTop: 'var(--sp-4)' }}>
          {t('deployment.finishHint')}
        </p>
      )}
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
