import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ShieldOff } from 'lucide-react';
import { grantedBy, ROLE_PERMISSIONS, type Permission } from '@/domain/permissions';
import { useSession } from '@/hooks/use-session';
import { useAppStore } from '@/store/app-store';

/**
 * Tela de acesso negado. Informa ação tentada, perfil atual, o que o perfil
 * pode, permissão necessária, quem concede. O botão de solicitar acesso grava
 * na auditoria.
 */
export function AccessDenied({ permission }: { permission: Permission }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const session = useSession();
  const recordAudit = useAppStore((s) => s.recordAudit);
  const [requested, setRequested] = useState(false);

  const suspended = session?.person.status === 'suspended';
  const currentRole = session?.roleKeys[0];
  const granter = grantedBy(permission);

  const canDo = useMemo(() => {
    if (!currentRole) return [];
    return (ROLE_PERMISSIONS[currentRole] ?? []).slice(0, 8);
  }, [currentRole]);

  const requestAccess = () => {
    recordAudit({
      action: 'access.request',
      objectType: 'Permission',
      objectId: permission,
      newValue: { requestedPermission: permission, from: currentRole },
      result: 'denied',
    });
    setRequested(true);
  };

  return (
    <div className="card" style={{ maxWidth: 640, margin: '0 auto' }}>
      <div className="row" style={{ marginBottom: 'var(--sp-4)' }}>
        <span
          className="icon-btn"
          style={{ color: 'var(--st-failed)', borderColor: 'var(--bd)' }}
          aria-hidden
        >
          <ShieldOff size={16} />
        </span>
        <h1 className="t-section">{t('denied.title')}</h1>
      </div>

      {suspended && (
        <p style={{ color: 'var(--st-failed)', marginBottom: 'var(--sp-4)' }}>
          {t('denied.suspended')}
        </p>
      )}

      <div className="stack" style={{ gap: 'var(--sp-3)' }}>
        <Row label={t('denied.attempted')} value={<code className="mono">{permission}</code>} />
        <Row
          label={t('denied.currentProfile')}
          value={currentRole ? t(`role.${currentRole}`) : '—'}
        />
        <Row label={t('denied.needed')} value={<code className="mono">{permission}</code>} />
        <Row label={t('denied.grantedBy')} value={t(`role.${granter}`)} />
        <div>
          <div className="t-micro">{t('denied.canDo')}</div>
          <div className="row" style={{ marginTop: 6 }}>
            {canDo.map((p) => (
              <span key={p} className="chip mono">
                {p}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="row" style={{ marginTop: 'var(--sp-5)' }}>
        <button
          type="button"
          className="btn btn-primary"
          onClick={requestAccess}
          disabled={requested || suspended}
        >
          {t('denied.requestAccess')}
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => navigate('/')}>
          {t('denied.backToOverview')}
        </button>
      </div>
      {requested && (
        <p style={{ color: 'var(--st-completed)', marginTop: 'var(--sp-3)' }}>
          {t('denied.requested')}
        </p>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="t-micro">{label}</div>
      <div style={{ marginTop: 4 }}>{value}</div>
    </div>
  );
}
