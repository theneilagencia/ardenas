import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/ui/PageHeader';
import { ROLE_PERMISSIONS } from '@/domain/permissions';
import type { RoleKey } from '@/domain/types';

const ROLE_KEYS: RoleKey[] = [
  'corporate_admin',
  'financial_admin',
  'operation_owner',
  'supervisor',
  'approver',
  'security_admin',
  'analyst',
  'auditor',
];

export function RolesPage() {
  const { t } = useTranslation();

  return (
    <>
      <PageHeader title={t('roles.title')} subtitle={t('roles.subtitle')} />
      <div className="stack">
        {ROLE_KEYS.map((key) => {
          const perms = ROLE_PERMISSIONS[key];
          return (
            <div key={key} className="card">
              <div className="card-head">
                <h2 className="t-section">{t(`role.${key}`)}</h2>
                <span className="chip mono">{t('roles.count', { count: perms.length })}</span>
              </div>
              <div className="row">
                {perms.map((p) => (
                  <span key={p} className="chip mono">
                    {p}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
