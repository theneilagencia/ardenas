import type { ReactNode } from 'react';

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 'var(--sp-4)',
        marginBottom: 'var(--sp-5)',
        flexWrap: 'wrap',
      }}
    >
      <div>
        <h1 className="t-module">{title}</h1>
        {subtitle && <p style={{ color: 'var(--tx2)', marginTop: 4 }}>{subtitle}</p>}
      </div>
      {actions && <div className="row">{actions}</div>}
    </header>
  );
}
