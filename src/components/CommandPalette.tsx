import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import * as Dialog from '@radix-ui/react-dialog';
import { Plus, Moon, Languages, PlayCircle } from 'lucide-react';
import { MODULES } from '@/app/modules';
import { usePermission } from '@/hooks/use-session';
import { useAppStore } from '@/store/app-store';
import { setLang } from '@/i18n';
import i18n from '@/i18n';

interface Item {
  id: string;
  label: string;
  section: 'nav' | 'actions';
  run: () => void;
}

export function CommandPalette() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const can = usePermission();
  const open = useAppStore((s) => s.cmdOpen);
  const setOpen = useAppStore((s) => s.setCmdOpen);
  const toggleTheme = useAppStore((s) => s.toggleTheme);
  const startTour = useAppStore((s) => s.startTour);
  const [query, setQuery] = useState('');

  // Atalho global ⌘K / Ctrl+K
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(!useAppStore.getState().cmdOpen);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setOpen]);

  useEffect(() => {
    if (open) setQuery('');
  }, [open]);

  const items = useMemo<Item[]>(() => {
    const close = () => setOpen(false);
    const nav: Item[] = MODULES.filter((m) => can(m.permission)).map((m) => ({
      id: `nav-${m.key}`,
      label: t(m.labelKey),
      section: 'nav',
      run: () => {
        navigate(m.path);
        close();
      },
    }));
    const actions: Item[] = [];
    if (can('operation.create')) {
      actions.push({
        id: 'act-new-op',
        label: t('cmd.newOperation'),
        section: 'actions',
        run: () => {
          navigate('/operations/new');
          close();
        },
      });
    }
    actions.push(
      {
        id: 'act-theme',
        label: t('cmd.toggleTheme'),
        section: 'actions',
        run: () => {
          toggleTheme();
          close();
        },
      },
      {
        id: 'act-lang',
        label: t('cmd.toggleLang'),
        section: 'actions',
        run: () => {
          setLang(i18n.language === 'pt-BR' ? 'en-US' : 'pt-BR');
          close();
        },
      },
      {
        id: 'act-tour',
        label: t('cmd.startTour'),
        section: 'actions',
        run: () => {
          startTour();
          close();
        },
      },
    );
    return [...nav, ...actions];
  }, [t, can, navigate, toggleTheme, startTour, setOpen]);

  const filtered = items.filter((i) => i.label.toLowerCase().includes(query.trim().toLowerCase()));
  const nav = filtered.filter((i) => i.section === 'nav');
  const actions = filtered.filter((i) => i.section === 'actions');

  const iconFor = (id: string) => {
    if (id === 'act-new-op') return <Plus size={15} aria-hidden />;
    if (id === 'act-theme') return <Moon size={15} aria-hidden />;
    if (id === 'act-lang') return <Languages size={15} aria-hidden />;
    if (id === 'act-tour') return <PlayCircle size={15} aria-hidden />;
    return null;
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content
          className="dialog-content"
          style={{ top: '18%', transform: 'translate(-50%, 0)', padding: 0, width: 'min(560px, calc(100vw - 32px))' }}
          aria-label={t('cmd.placeholder')}
        >
          <Dialog.Title style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
            {t('cmd.placeholder')}
          </Dialog.Title>
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('cmd.placeholder')}
            aria-label={t('cmd.placeholder')}
            style={{
              width: '100%',
              padding: '14px 16px',
              border: 'none',
              borderBottom: '1px solid var(--bd)',
              background: 'transparent',
              color: 'var(--tx)',
              fontSize: '0.9375rem',
              outline: 'none',
              fontFamily: 'inherit',
            }}
          />
          <div style={{ maxHeight: '52vh', overflowY: 'auto', padding: 8 }}>
            {filtered.length === 0 && (
              <div className="empty-state" style={{ border: 'none' }}>
                {t('cmd.noResults')}
              </div>
            )}
            {nav.length > 0 && (
              <div className="t-micro" style={{ padding: '8px 10px 4px' }}>
                {t('cmd.sectionNav')}
              </div>
            )}
            {nav.map((i) => (
              <button key={i.id} type="button" className="menu-item" style={{ width: '100%' }} onClick={i.run}>
                {i.label}
              </button>
            ))}
            {actions.length > 0 && (
              <div className="t-micro" style={{ padding: '8px 10px 4px' }}>
                {t('cmd.sectionActions')}
              </div>
            )}
            {actions.map((i) => (
              <button
                key={i.id}
                type="button"
                className="menu-item"
                style={{ width: '100%', gap: 10 }}
                onClick={i.run}
              >
                {iconFor(i.id)}
                {i.label}
              </button>
            ))}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
