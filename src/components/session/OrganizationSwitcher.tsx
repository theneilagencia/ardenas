/**
 * Arden.AS — seletor de organização (ARDEN-FE-002).
 * Lista as organizações às quais o usuário TEM membership e troca de tenant em
 * um único ponto (TenantContext). Memberships suspensas aparecem desabilitadas.
 * O usuário nunca escolhe um tenant arbitrário: só o que a sessão permite.
 */

import { useTranslation } from 'react-i18next';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Check, ChevronsUpDown } from 'lucide-react';
import { useTenant } from '@/app/tenant-context';
import { activeMembership } from '@/domain/identity';

export function OrganizationSwitcher() {
  const { t } = useTranslation();
  const { session, activeOrganization, switchOrganization } = useTenant();
  const memberships = session?.memberships ?? [];
  const organizations = session?.organizations ?? [];
  const active = activeMembership(session);

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button type="button" className="org-switch" title={t('org.switch')} data-testid="org-switch">
          <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
            <div className="t-micro">{t('org.active')}</div>
            <div style={{ fontWeight: 500, fontSize: '0.8125rem' }}>
              {activeOrganization?.name ?? '—'}
            </div>
          </div>
          <ChevronsUpDown size={15} aria-hidden />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className="menu" sideOffset={6} align="start">
          <div className="t-micro" style={{ padding: '6px 10px' }}>
            {t('org.switch')}
          </div>
          {organizations.map((org) => {
            const membership = memberships.find((m) => m.organizationId === org.id);
            const disabled = !membership || membership.status !== 'active';
            const isActive = org.id === activeOrganization?.id;
            return (
              <DropdownMenu.Item
                key={org.id}
                className="menu-item"
                data-active={isActive}
                disabled={disabled}
                data-testid={`org-option-${org.slug}`}
                onSelect={() => {
                  if (!disabled && !isActive) void switchOrganization(org.id);
                }}
              >
                <span style={{ flex: 1 }}>{org.name}</span>
                {isActive && <Check size={14} aria-hidden />}
                {disabled && !isActive && (
                  <span className="t-micro">{t('org.suspendedMembership')}</span>
                )}
              </DropdownMenu.Item>
            );
          })}
          {active && (
            <div className="t-micro" style={{ padding: '6px 10px', color: 'var(--tx2)' }}>
              {t('org.roleInOrg')}: {active.roleIds.map((r) => t(`role.${r}`)).join(', ')}
            </div>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
