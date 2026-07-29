import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { PageHeader } from '@/components/ui/PageHeader';
import { OperationStateBadge } from '@/components/ui/StateBadge';
import { useScopedData, usePermission } from '@/hooks/use-session';
import { useAppStore } from '@/store/app-store';

export function OperationDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { operations, people } = useScopedData();
  const can = usePermission();
  const startExecution = useAppStore((s) => s.startExecution);
  const pauseOperation = useAppStore((s) => s.pauseOperation);
  const resumeOperation = useAppStore((s) => s.resumeOperation);

  const op = operations.find((o) => o.id === id);
  if (!op) {
    return <div className="empty-state">{t('common.empty')}</div>;
  }

  const ownerName = people.find((p) => p.id === op.ownerId)?.name ?? op.ownerId;

  const runTest = () => {
    const exec = startExecution(op.id, { test: true });
    navigate(`/executions/${exec.id}`);
  };

  return (
    <>
      <PageHeader
        title={op.name}
        subtitle={`${op.problem}`}
        actions={
          <>
            {can('execution.start', op) && (
              <button type="button" className="btn btn-ghost" onClick={runTest}>
                {t('operations.testRun')}
              </button>
            )}
            {can('operation.pause', op) &&
              (op.status === 'paused' ? (
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => resumeOperation(op.id)}
                >
                  {t('operations.resume')}
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => pauseOperation(op.id)}
                >
                  {t('operations.pause')}
                </button>
              ))}
            {can('execution.start', op) && (
              <button type="button" className="btn btn-primary" onClick={() => startExecution(op.id)}>
                {t('operations.runNow')}
              </button>
            )}
          </>
        }
      />

      <div className="row" style={{ marginBottom: 'var(--sp-4)' }}>
        <OperationStateBadge status={op.status} />
        <span className="chip mono">v{op.version}</span>
        <span className="chip">{op.criticality}</span>
        {op.environment && <span className="chip">{op.environment}</span>}
      </div>

      <div className="stack">
        <section className="card">
          <h2 className="t-section" style={{ marginBottom: 'var(--sp-3)' }}>
            {t('operations.result')}
          </h2>
          <div className="grid-tiles">
            <Field label="Objetivo" value={op.objective} />
            <Field label={t('wizard.field.expectedResult')} value={op.expectedResult} />
            <Field label="SLA" value={op.sla} />
            <Field label="Frequência" value={op.frequency} />
          </div>
        </section>

        <section className="card">
          <h2 className="t-section" style={{ marginBottom: 'var(--sp-3)' }}>
            {t('operations.responsibles')}
          </h2>
          <Field label={t('common.owner')} value={ownerName} />
        </section>

        <section className="card">
          <h2 className="t-section" style={{ marginBottom: 'var(--sp-3)' }}>
            {t('operations.steps')} ({op.steps.length})
          </h2>
          {op.steps.length === 0 ? (
            <div className="empty-state">{t('operations.noSteps')}</div>
          ) : (
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="mono">#</th>
                    <th>{t('operations.steps')}</th>
                    <th>{t('risk.gradient')}</th>
                    <th className="mono">WU</th>
                  </tr>
                </thead>
                <tbody>
                  {[...op.steps]
                    .sort((a, b) => a.order - b.order)
                    .map((s) => (
                      <tr key={s.id}>
                        <td className="mono">{s.order}</td>
                        <td>
                          <strong>{s.name}</strong>
                          <div style={{ color: 'var(--tx2)' }}>{s.description}</div>
                        </td>
                        <td>
                          <code className="mono">{s.authorityLevel}</code>
                          {s.requiresApproval && (
                            <span className="chip" style={{ marginLeft: 6 }}>
                              {t('common.approve')}
                            </span>
                          )}
                        </td>
                        <td className="mono">{s.workUnitCost}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="card">
          <div className="card-head">
            <h2 className="t-section">{t('operations.control')}</h2>
            <Link to="/budget" className="btn btn-ghost btn-sm">
              {t('common.edit')}
            </Link>
          </div>
          <div className="grid-tiles">
            <Field label={t('wizard.field.budget')} value={`R$ ${op.budget.toLocaleString('pt-BR')}`} />
            <Field label="Work Units" value={String(op.workUnits)} />
            <Field label={t('wizard.field.evidencePolicy')} value={op.evidencePolicy} />
          </div>
        </section>
      </div>
    </>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="t-micro">{label}</div>
      <div style={{ marginTop: 4 }}>{value}</div>
    </div>
  );
}
