import { useTranslation } from 'react-i18next';
import { Bell, HelpCircle, Menu, Moon, Sun } from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { useAppStore } from '@/store/app-store';
import { useScopedData, useSession } from '@/hooks/use-session';
import { setLang, type Lang } from '@/i18n';
import type { RoleKey } from '@/domain/types';

const DEMO_ROLES: RoleKey[] = [
  'corporate_admin',
  'financial_admin',
  'operation_owner',
  'supervisor',
  'approver',
  'security_admin',
  'analyst',
  'auditor',
];

export function Topbar() {
  const { t, i18n } = useTranslation();
  const theme = useAppStore((s) => s.theme);
  const toggleTheme = useAppStore((s) => s.toggleTheme);
  const setDrawerOpen = useAppStore((s) => s.setDrawerOpen);
  const setAssistantOpen = useAppStore((s) => s.setAssistantOpen);
  const switchProfile = useAppStore((s) => s.switchProfile);
  const markRead = useAppStore((s) => s.markNotificationsRead);
  const session = useSession();
  const { notifications } = useScopedData();

  const unread = notifications.filter((n) => !n.read).length;
  const profileSwitcherEnabled = import.meta.env.VITE_ENABLE_PROFILE_SWITCHER !== 'false';
  const currentRole = session?.roleKeys[0];

  return (
    <div className="topbar">
      <button
        type="button"
        className="icon-btn mobile-only"
        onClick={() => setDrawerOpen(true)}
        aria-label="Abrir navegação"
      >
        <Menu size={16} aria-hidden />
      </button>

      <input
        className="topbar-search"
        placeholder={t('app.searchPlaceholder')}
        aria-label={t('app.searchPlaceholder')}
      />

      <div style={{ flex: 1 }} />

      {/* Idioma */}
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button type="button" className="icon-btn mono" aria-label="Idioma">
            {i18n.language === 'pt-BR' ? 'PT' : 'EN'}
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content className="menu" sideOffset={6} align="end">
            {(['pt-BR', 'en-US'] as Lang[]).map((lng) => (
              <DropdownMenu.Item
                key={lng}
                className="menu-item"
                onSelect={() => {
                  const prev = i18n.language;
                  setLang(lng);
                  if (prev !== lng) {
                    useAppStore.getState().recordAudit({
                      action: 'language.change',
                      objectType: 'Session',
                      objectId: session?.person.id ?? 'anon',
                      previousValue: { lang: prev },
                      newValue: { lang: lng },
                    });
                  }
                }}
              >
                {lng === 'pt-BR' ? 'Português (BR)' : 'English (US)'}
              </DropdownMenu.Item>
            ))}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      {/* Perfil de demonstração — atrás de flag, não existe em produção */}
      {profileSwitcherEnabled && (
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button type="button" className="btn btn-ghost btn-sm" title={t('profile.switch')}>
              {currentRole ? t(`role.${currentRole}`) : t('profile.switch')}
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content className="menu" sideOffset={6} align="end">
              <div className="t-micro" style={{ padding: '6px 10px' }}>
                {t('profile.switch')}
              </div>
              {DEMO_ROLES.map((role) => (
                <DropdownMenu.Item
                  key={role}
                  className="menu-item"
                  data-active={role === currentRole}
                  onSelect={() => switchProfile(role)}
                >
                  {t(`role.${role}`)}
                </DropdownMenu.Item>
              ))}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      )}

      <button
        type="button"
        className="icon-btn"
        onClick={() => setAssistantOpen(true)}
        aria-label={t('assistant.title')}
      >
        <HelpCircle size={16} aria-hidden />
      </button>

      <button
        type="button"
        className="icon-btn"
        onClick={markRead}
        aria-label={t('nav.notifications')}
        style={{ position: 'relative' }}
      >
        <Bell size={16} aria-hidden />
        {unread > 0 && (
          <span
            aria-hidden
            style={{
              position: 'absolute',
              top: 4,
              right: 4,
              width: 7,
              height: 7,
              borderRadius: 999,
              background: 'var(--st-waiting)',
            }}
          />
        )}
      </button>

      <button
        type="button"
        className="icon-btn"
        onClick={toggleTheme}
        aria-label={t('theme.toggle')}
      >
        {theme === 'light' ? <Moon size={16} aria-hidden /> : <Sun size={16} aria-hidden />}
      </button>
    </div>
  );
}
