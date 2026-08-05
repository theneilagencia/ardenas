import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/ui/PageHeader';
import { usePermission } from '@/hooks/use-session';
import {
  useOperations,
  usePromoteEnvironment,
  useRollbackEnvironment,
} from '@/hooks/use-operations';

const ORDER = ['sandbox', 'staging', 'production'] as const;

export function EnvironmentsPage() {
  const { t } = useTranslation();
  const { operations } = useOperations();
  const can = usePermission();
  const promoteMut = usePromoteEnvironment();
  const rollbackMut = useRollbackEnvironment();
  const promote = (id: string) => promoteMut.mutate(id);
  const rollback = (id: string) => rollbackMut.mutate(id);
  const canManage = can('operation.edit');

  const deployed = operations.filter((o) => o.status !== 'draft');

  return (
    <>
      <PageHeader title={t('environments.title')} subtitle={t('environments.subtitle')} />
      <div className="stack">
        {deployed.map((op) => {
          const idx = op.environment ? ORDER.indexOf(op.environment) : -1;
          return (
            <div key={op.id} className="card">
              <div className="card-head">
                <div>
                  <strong>{op.name}</strong>
                  <div className="t-micro">{t('environments.current')}</div>
                </div>
                <div className="row">
                  {ORDER.map((env, i) => (
                    <span
                      key={env}
                      className="chip"
                      style={{
                        background: i === idx ? 'var(--ac)' : 'var(--mut)',
                        color: i === idx ? 'var(--ac-fg)' : 'var(--tx2)',
                        borderColor: i === idx ? 'transparent' : 'var(--bd)',
                      }}
                    >
                      {env}
                    </span>
                  ))}
                </div>
              </div>
              {canManage && (
                <div className="row">
                  <button
                    type="button"
                    className="btn btn-sm btn-ghost"
                    disabled={idx <= 0}
                    onClick={() => rollback(op.id)}
                  >
                    {t('environments.rollback')}
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-primary"
                    disabled={idx >= ORDER.length - 1}
                    onClick={() => promote(op.id)}
                  >
                    {t('environments.promote')}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
