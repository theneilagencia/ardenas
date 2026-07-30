import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/ui/PageHeader';
import { Drawer, DrawerField } from '@/components/ui/Drawer';
import { useScopedData, usePermission } from '@/hooks/use-session';
import { useAppStore } from '@/store/app-store';
import type { Person, PersonStatus, RoleKey } from '@/domain/types';

const STATUS_KEY: Record<PersonStatus, string> = {
  active: 'people.statusActive',
  invited: 'people.statusInvited',
  suspended: 'people.statusSuspended',
};

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

export function PeoplePage() {
  const { t } = useTranslation();
  const { people } = useScopedData();
  const can = usePermission();
  const invite = useAppStore((s) => s.invitePerson);
  const suspend = useAppStore((s) => s.suspendPerson);
  const reactivate = useAppStore((s) => s.reactivatePerson);
  const updateRoles = useAppStore((s) => s.updatePersonRoles);

  const canCreate = can('people.create');
  const canSuspend = can('people.suspend');
  const canEdit = can('people.edit');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<RoleKey>('analyst');
  const [selected, setSelected] = useState<Person | null>(null);

  const onInvite = () => {
    if (!name.trim() || !email.trim()) return;
    invite({ name: name.trim(), email: email.trim(), roleKeys: [role] });
    setName('');
    setEmail('');
  };

  return (
    <>
      <PageHeader title={t('people.title')} />

      {canCreate && (
        <div className="card" style={{ marginBottom: 'var(--sp-4)' }}>
          <h2 className="t-section" style={{ marginBottom: 'var(--sp-3)' }}>
            {t('people.invite')}
          </h2>
          <div className="row" style={{ alignItems: 'flex-end', gap: 'var(--sp-3)' }}>
            <div className="field" style={{ margin: 0, flex: 1, minWidth: 160 }}>
              <label htmlFor="np-name">{t('people.name')}</label>
              <input id="np-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="field" style={{ margin: 0, flex: 1, minWidth: 180 }}>
              <label htmlFor="np-email">{t('people.email')}</label>
              <input id="np-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="field" style={{ margin: 0, minWidth: 160 }}>
              <label htmlFor="np-role">{t('people.roles')}</label>
              <select id="np-role" value={role} onChange={(e) => setRole(e.target.value as RoleKey)}>
                {ROLE_KEYS.map((r) => (
                  <option key={r} value={r}>
                    {t(`role.${r}`)}
                  </option>
                ))}
              </select>
            </div>
            <button type="button" className="btn btn-primary" onClick={onInvite}>
              {t('people.invite')}
            </button>
          </div>
        </div>
      )}

      <div className="card">
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('people.name')}</th>
                <th>{t('people.roles')}</th>
                <th>{t('common.status')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {people.map((p) => (
                <tr key={p.id}>
                  <td>
                    <button
                      type="button"
                      onClick={() => setSelected(p)}
                      style={{
                        border: 0,
                        background: 'none',
                        padding: 0,
                        cursor: 'pointer',
                        color: 'var(--tx)',
                        font: 'inherit',
                        fontWeight: 600,
                        textAlign: 'left',
                      }}
                    >
                      {p.name}
                    </button>
                    <div style={{ color: 'var(--tx2)' }}>{p.email}</div>
                  </td>
                  <td>
                    {canEdit ? (
                      <select
                        value={p.roleKeys[0]}
                        onChange={(e) => updateRoles(p.id, [e.target.value as RoleKey])}
                        aria-label={t('people.editRoles')}
                        className="btn btn-sm btn-ghost"
                      >
                        {ROLE_KEYS.map((r) => (
                          <option key={r} value={r}>
                            {t(`role.${r}`)}
                          </option>
                        ))}
                      </select>
                    ) : (
                      p.roleKeys.map((r) => (
                        <span key={r} className="chip" style={{ marginRight: 4 }}>
                          {t(`role.${r}`)}
                        </span>
                      ))
                    )}
                  </td>
                  <td>
                    <span className="badge">{t(STATUS_KEY[p.status])}</span>
                  </td>
                  <td>
                    {canSuspend &&
                      (p.status === 'suspended' ? (
                        <button
                          type="button"
                          className="btn btn-sm btn-ghost"
                          onClick={() => reactivate(p.id)}
                        >
                          {t('people.reactivate')}
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-sm btn-ghost"
                          onClick={() => suspend(p.id)}
                        >
                          {t('people.suspend')}
                        </button>
                      ))}
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
        title={selected?.name ?? ''}
      >
        {selected && (
          <>
            <DrawerField label={t('people.email')} value={selected.email} />
            <DrawerField
              label={t('people.roles')}
              value={
                <div className="row">
                  {selected.roleKeys.map((r) => (
                    <span key={r} className="chip">
                      {t(`role.${r}`)}
                    </span>
                  ))}
                </div>
              }
            />
            <DrawerField label={t('common.status')} value={t(STATUS_KEY[selected.status])} />
            <DrawerField label="ID" value={<code className="mono">{selected.id}</code>} />
          </>
        )}
      </Drawer>
    </>
  );
}
