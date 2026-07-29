import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/ui/PageHeader';

/**
 * Módulo mapeado, com permissão e navegação. O detalhamento de tela segue na
 * sequência da reconstrução — declarado como pendente, não escondido.
 */
export function ModulePlaceholder({
  labelKey,
  count,
  countLabel,
}: {
  labelKey: string;
  count?: number;
  countLabel?: string;
}) {
  const { t } = useTranslation();
  const title = t(labelKey);
  return (
    <>
      <PageHeader title={title} />
      {typeof count === 'number' && (
        <div className="metric-tile" style={{ maxWidth: 240, marginBottom: 'var(--sp-4)' }}>
          <span className="t-micro">{countLabel ?? title}</span>
          <span className="t-metric">{count}</span>
        </div>
      )}
      <div className="empty-state">{t('placeholder.note')}</div>
    </>
  );
}
