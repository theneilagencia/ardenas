import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';

/** Painel lateral de detalhe reutilizável. Elevação só em overlay. */
export function Drawer({
  open,
  onOpenChange,
  title,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="drawer-content" aria-describedby={undefined}>
          <div className="card-head">
            <Dialog.Title asChild>
              <h2 className="t-section">{title}</h2>
            </Dialog.Title>
            <Dialog.Close asChild>
              <button type="button" className="icon-btn" aria-label={t('common.cancel')}>
                <X size={15} aria-hidden />
              </button>
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function DrawerField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div style={{ marginBottom: 'var(--sp-4)' }}>
      <div className="t-micro">{label}</div>
      <div style={{ marginTop: 4 }}>{value}</div>
    </div>
  );
}
