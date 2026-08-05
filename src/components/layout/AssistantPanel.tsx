import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import { useAppStore } from '@/store/app-store';
import { useScopedData } from '@/hooks/use-session';
import { useOperations } from '@/hooks/use-operations';

/**
 * Assistente contextual determinístico. Composto a partir da store.
 * Sem API externa. Fatos reais, próximo passo concreto e links que abrem objetos.
 */
export function AssistantPanel() {
  const { t } = useTranslation();
  const open = useAppStore((s) => s.assistantOpen);
  const setOpen = useAppStore((s) => s.setAssistantOpen);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const data = useScopedData();
  const { operations } = useOperations();

  if (!open) return null;

  const pendingApprovals = data.approvals.filter((a) => a.state === 'pending').length;
  const openExceptions = data.exceptions.filter((e) => e.state === 'open').length;
  const deployment = data.deployments[0];
  const deployDone = deployment?.steps.filter((s) => s.done).length ?? 0;

  let fact: string;
  let next: string;
  const links: Array<{ label: string; to: string }> = [];

  if (pathname.startsWith('/operations')) {
    fact = t('assistant.opsFact', { count: operations.length });
    next = t('assistant.opsNext');
    links.push({ label: t('nav.operations'), to: '/operations' });
  } else if (pathname.startsWith('/deployment')) {
    fact = t('assistant.deployFact', { done: deployDone, total: deployment?.steps.length ?? 16 });
    next = t('assistant.deployNext');
    links.push({ label: t('nav.deployment'), to: '/deployment' });
  } else {
    fact = t('assistant.overviewFact', {
      ops: operations.length,
      pending: pendingApprovals,
      exceptions: openExceptions,
    });
    next = t('assistant.overviewNext');
    links.push({ label: t('nav.approvals'), to: '/approvals' });
  }

  return (
    <aside className="assistant" aria-label={t('assistant.title')}>
      <div className="card-head" style={{ marginBottom: 'var(--sp-5)' }}>
        <h2 className="t-section">{t('assistant.title')}</h2>
        <button
          type="button"
          className="icon-btn"
          onClick={() => setOpen(false)}
          aria-label={t('common.cancel')}
        >
          <X size={16} aria-hidden />
        </button>
      </div>

      <div className="stack">
        <div>
          <div className="t-micro">{t('assistant.facts')}</div>
          <p style={{ marginTop: 6 }}>{fact}</p>
        </div>
        <div>
          <div className="t-micro">{t('assistant.nextStep')}</div>
          <p style={{ marginTop: 6 }}>{next}</p>
        </div>
        <div>
          <div className="t-micro">{t('assistant.links')}</div>
          <div className="row" style={{ marginTop: 8 }}>
            {links.map((l) => (
              <button
                key={l.to}
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  navigate(l.to);
                  setOpen(false);
                }}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}
