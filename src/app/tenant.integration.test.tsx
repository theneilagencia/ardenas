import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { queryClient } from '@/lib/query-client';
import { TenantProvider } from './tenant-provider';
import { useTenant } from './tenant-context';
import { SessionBoundary } from '@/components/session/SessionBoundary';
import { OrganizationBoundary } from '@/components/session/OrganizationBoundary';
import { PermissionBoundary } from '@/components/session/PermissionBoundary';
import { setSessionRepository, setSnapshotStore, setServices } from '@/services/service-container';
import { MemorySnapshotStore } from '@/services/data/snapshot-store';
import { MockSessionRepository } from '@/services/session/mock-session-repository';
import { buildSeed } from '@/domain/seed';
import '@/i18n';

function wrap(ui: React.ReactNode) {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <TenantProvider>{ui}</TenantProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function TenantProbe() {
  const { activeOrganization, can, switchOrganization } = useTenant();
  return (
    <div>
      <span data-testid="active-org">{activeOrganization?.id ?? 'none'}</span>
      <span data-testid="can-publish">{String(can('operation.publish'))}</span>
      <button data-testid="to-b" onClick={() => void switchOrganization('org_b')}>
        b
      </button>
      <button data-testid="to-x" onClick={() => void switchOrganization('org_x').catch(() => {})}>
        x
      </button>
    </div>
  );
}

beforeEach(() => {
  cleanup();
  queryClient.clear();
  setSnapshotStore(new MemorySnapshotStore(buildSeed()));
  setServices(null);
});

describe('TenantProvider + boundaries', () => {
  it('SessionBoundary mostra estado não autenticado quando não há sessão', async () => {
    setSessionRepository(new MockSessionRepository(null));
    wrap(
      <SessionBoundary>
        <div data-testid="app">APP</div>
      </SessionBoundary>,
    );
    expect(await screen.findByTestId('session-state-title')).toBeInTheDocument();
    expect(screen.queryByTestId('app')).not.toBeInTheDocument();
  });

  it('OrganizationBoundary mostra "sem organização" quando não há org ativa', async () => {
    setSessionRepository(new MockSessionRepository('no_org'));
    wrap(
      <OrganizationBoundary>
        <div data-testid="app">APP</div>
      </OrganizationBoundary>,
    );
    expect(await screen.findByTestId('session-state-title')).toBeInTheDocument();
    expect(screen.queryByTestId('app')).not.toBeInTheDocument();
  });

  it('PermissionBoundary bloqueia sem permissão (acesso negado)', async () => {
    setSessionRepository(new MockSessionRepository('insufficient_permission'));
    wrap(
      <PermissionBoundary permission="operation.publish">
        <div data-testid="app">APP</div>
      </PermissionBoundary>,
    );
    // Aguarda a resolução da sessão; a ação protegida não deve aparecer.
    await waitFor(() => expect(screen.queryByTestId('app')).not.toBeInTheDocument());
  });

  it('can() reflete as permissões da sessão ativa', async () => {
    setSessionRepository(new MockSessionRepository('many_orgs'));
    wrap(<TenantProbe />);
    await waitFor(() => expect(screen.getByTestId('active-org').textContent).toBe('org_a'));
    expect(screen.getByTestId('can-publish').textContent).toBe('true');
  });

  it('troca de organização limpa o cache e troca o tenant ativo', async () => {
    setSessionRepository(new MockSessionRepository('many_orgs'));
    // Semeia um cache do tenant anterior.
    queryClient.setQueryData(['operations', 'org_a', {}], { items: [{ id: 'x' }] });
    wrap(<TenantProbe />);
    await waitFor(() => expect(screen.getByTestId('active-org').textContent).toBe('org_a'));

    fireEvent.click(screen.getByTestId('to-b'));

    await waitFor(() => expect(screen.getByTestId('active-org').textContent).toBe('org_b'));
    // O cache do tenant anterior foi limpo (sem vazamento entre organizações).
    expect(queryClient.getQueryData(['operations', 'org_a', {}])).toBeUndefined();
  });

  it('troca inválida mantém a organização anterior', async () => {
    setSessionRepository(new MockSessionRepository('many_orgs'));
    wrap(<TenantProbe />);
    await waitFor(() => expect(screen.getByTestId('active-org').textContent).toBe('org_a'));

    fireEvent.click(screen.getByTestId('to-x'));
    // Espera um ciclo; a organização ativa permanece org_a.
    await new Promise((r) => setTimeout(r, 10));
    expect(screen.getByTestId('active-org').textContent).toBe('org_a');
  });
});
