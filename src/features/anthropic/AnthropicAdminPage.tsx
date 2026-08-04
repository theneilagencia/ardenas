/**
 * Arden.AS — administração do provider Anthropic (ARDEN-BE-008.6 §8/§9/§25/§38/§39).
 *
 * Página SOMENTE de status + preparação: consome o provider real da API v1 (`useModelProviders`)
 * e apresenta claramente os estados NÃO resumíveis a "ativo/inativo": produção BLOQUEADA, preço
 * NÃO VERIFICADO, governança de dados NÃO VERIFICADA, live smoke NÃO EXECUTADO, tool calling
 * validado OFFLINE. NUNCA expõe segredo; NUNCA importa SDK; NUNCA gera texto/prompt. A criação de
 * connection segura e a configuração de modelo usam as telas provider-neutras existentes.
 */

import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Ban, CircleSlash, FlaskConical, ShieldAlert, Wrench } from 'lucide-react';
import { ANTHROPIC_PROVIDER_KEY, ANTHROPIC_PROVIDER_VERSION, ANTHROPIC_CONNECTOR_KEY } from '@/contracts';
import { useModelProviders } from '@/hooks/use-agents';
import { PageHeader } from '@/components/ui/PageHeader';
import { ModelProviderStatusBadge } from '@/features/agents/AgentStatusBadge';
import { AnthropicModelCatalog } from './AnthropicModelCatalog';
import { AnthropicConnections } from './AnthropicConnections';

/** Linha de estado acessível: texto + ícone (nunca só cor). */
function StatusRow({ icon, label, value, tone = 'warn' }: { icon: React.ReactNode; label: string; value: string; tone?: 'warn' | 'info' | 'danger' }) {
  return (
    <div className="row" role="status" style={{ gap: 8, alignItems: 'center', padding: '6px 0' }} data-tone={tone}>
      <span aria-hidden style={{ display: 'inline-flex' }}>{icon}</span>
      <span style={{ color: 'var(--tx2)', minWidth: 220 }}>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function AnthropicAdminPage() {
  const { t } = useTranslation();
  const { providers, isLoading, error, refetch } = useModelProviders();

  const provider = useMemo(
    () => providers.find((p) => p.key === ANTHROPIC_PROVIDER_KEY),
    [providers],
  );

  if (isLoading) return <p role="status">{t('anthropic.loading')}</p>;
  if (error) {
    return (
      <div>
        <PageHeader title={t('anthropic.title')} />
        <p role="alert" className="error">{t('anthropic.loadError')}</p>
        <button type="button" className="btn btn-sm" onClick={() => refetch()}>{t('anthropic.retry')}</button>
      </div>
    );
  }
  if (!provider) {
    return (
      <div>
        <PageHeader title={t('anthropic.title')} subtitle={t('anthropic.subtitle')} />
        <p role="status">{t('anthropic.notFound')}</p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={t('anthropic.title')}
        subtitle={t('anthropic.subtitle')}
        actions={
          <>
            <Link className="btn btn-sm" to="/integrations?tab=connections">{t('anthropic.actions.configureConnection')}</Link>
            <Link className="btn btn-sm btn-ghost" to="/model-configurations">{t('anthropic.actions.modelConfigurations')}</Link>
          </>
        }
      />

      {/* Banner permanente: produção bloqueada (nunca escondido). §25 */}
      <div className="card" role="alert" style={{ borderColor: 'var(--danger, #b3261e)', marginBottom: 'var(--sp-4)' }}>
        <div className="row" style={{ gap: 8, alignItems: 'center' }}>
          <Ban size={18} aria-hidden />
          <strong>{t('anthropic.productionBlocked')}</strong>
        </div>
        <p style={{ color: 'var(--tx2)', marginTop: 6 }}>{t('anthropic.availabilityMessage')}</p>
      </div>

      {/* Resumo do provider (dados reais da API). */}
      <section className="card" style={{ marginBottom: 'var(--sp-4)' }} aria-labelledby="anthropic-summary">
        <h2 id="anthropic-summary" className="t-section">{t('anthropic.summary')}</h2>
        <dl className="kv">
          <dt>{t('anthropic.fields.name')}</dt><dd>{provider.name}</dd>
          <dt>{t('anthropic.fields.providerKey')}</dt><dd><code>{ANTHROPIC_PROVIDER_KEY}</code></dd>
          <dt>{t('anthropic.fields.providerVersion')}</dt><dd><code>{ANTHROPIC_PROVIDER_VERSION}</code></dd>
          <dt>{t('anthropic.fields.connector')}</dt><dd><code>{ANTHROPIC_CONNECTOR_KEY}</code></dd>
          <dt>{t('anthropic.fields.status')}</dt><dd><ModelProviderStatusBadge status={provider.status} /></dd>
          <dt>{t('anthropic.fields.capabilities')}</dt>
          <dd>{provider.capabilities.length > 0 ? provider.capabilities.map((c) => <span key={c} className="badge" style={{ marginRight: 6 }}>{c}</span>) : t('anthropic.none')}</dd>
          <dt>{t('anthropic.fields.productionAllowed')}</dt>
          <dd><strong>{provider.productionAllowed ? t('anthropic.yes') : t('anthropic.no')}</strong></dd>
        </dl>
      </section>

      {/* Estados de verificação — texto + ícone, não só cor. §9 */}
      <section className="card" aria-labelledby="anthropic-verification">
        <h2 id="anthropic-verification" className="t-section">{t('anthropic.verification')}</h2>
        <StatusRow icon={<AlertTriangle size={16} />} label={t('anthropic.pricing')} value={t('anthropic.unverified')} />
        <StatusRow icon={<ShieldAlert size={16} />} label={t('anthropic.dataGovernance')} value={t('anthropic.unverified')} />
        <StatusRow icon={<FlaskConical size={16} />} label={t('anthropic.liveSmoke')} value={t('anthropic.notExecuted')} />
        <StatusRow icon={<Wrench size={16} />} label={t('anthropic.toolCalling')} value={t('anthropic.offlineVerified')} tone="info" />
        <StatusRow icon={<CircleSlash size={16} />} label={t('anthropic.availability')} value={t('anthropic.controlledNonProd')} tone="info" />
        <p style={{ color: 'var(--tx2)', marginTop: 10 }}>{t('anthropic.verificationNote')}</p>
      </section>

      {/* Catálogo de modelos (dados reais da API). §5 */}
      <AnthropicModelCatalog />

      {/* Conexões Anthropic seguras (criar, validar, rotacionar, lifecycle). §7–§12 */}
      <AnthropicConnections />
    </div>
  );
}

export default AnthropicAdminPage;
