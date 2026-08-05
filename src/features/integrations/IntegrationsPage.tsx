import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/ui/PageHeader';
import { CatalogTab } from './CatalogTab';
import { ConnectionsTab } from './ConnectionsTab';
import { ToolBindingsTab } from './ToolBindingsTab';
import { WebhooksTab } from './WebhooksTab';

const TABS = ['catalog', 'connections', 'toolBindings', 'webhooks'] as const;
type Tab = (typeof TABS)[number];

function isTab(value: string | null): value is Tab {
  return (TABS as readonly string[]).includes(value ?? '');
}

/**
 * Integrações (ARDEN-BE-006.8): catálogo de conectores, conexões, vínculos de
 * ferramenta e webhooks — 100% API-backed (sem mock/IndexedDB). O tenant vem
 * sempre da sessão ativa; segredos (credencial, token de webhook) nunca saem do
 * estado local dos formulários.
 */
export function IntegrationsPage() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const tab: Tab = isTab(params.get('tab')) ? (params.get('tab') as Tab) : 'catalog';

  const setTab = (next: Tab) => {
    const nextParams = new URLSearchParams(params);
    nextParams.set('tab', next);
    setParams(nextParams, { replace: true });
  };

  return (
    <>
      <PageHeader title={t('integrations.title')} subtitle={t('integrations.subtitle')} />

      <div className="row" style={{ marginBottom: 'var(--sp-4)' }} role="tablist" aria-label={t('integrations.title')}>
        {TABS.map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            className={`btn btn-sm${tab === key ? ' btn-primary' : ' btn-ghost'}`}
            onClick={() => setTab(key)}
          >
            {t(`integrations.tabs.${key}`)}
          </button>
        ))}
      </div>

      {tab === 'catalog' && <CatalogTab />}
      {tab === 'connections' && <ConnectionsTab />}
      {tab === 'toolBindings' && <ToolBindingsTab />}
      {tab === 'webhooks' && <WebhooksTab />}
    </>
  );
}
