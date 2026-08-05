import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Eye, EyeOff } from 'lucide-react';

/**
 * Campo de segredo (credencial, token/segredo de webhook). O valor SÓ existe no
 * estado local do componente pai (via `value`/`onChange`) — nunca é elevado a um
 * estado global (Zustand, cache do React Query, localStorage/sessionStorage,
 * IndexedDB ou URL). `type="password"` por padrão, com alternância explícita.
 */
export function SecretField({
  id,
  label,
  value,
  onChange,
  autoFocus,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoFocus?: boolean;
}) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="row" style={{ alignItems: 'stretch' }}>
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          autoComplete="new-password"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoFocus={autoFocus}
          style={{ flex: 1 }}
        />
        <button
          type="button"
          className="btn btn-sm btn-ghost"
          onClick={() => setVisible((v) => !v)}
          aria-pressed={visible}
          aria-label={
            visible
              ? t('integrations.connections.hideSecret')
              : t('integrations.connections.showSecret')
          }
        >
          {visible ? <EyeOff size={15} aria-hidden /> : <Eye size={15} aria-hidden />}
        </button>
      </div>
    </div>
  );
}
