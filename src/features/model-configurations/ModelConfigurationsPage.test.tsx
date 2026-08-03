/**
 * Arden.AS — teste da tela de configurações de modelo (ARDEN-BE-007.7 §14–16, §46).
 * Catálogo de providers (interno marcado somente-teste); lifecycle da configuração
 * via comandos do backend; sem campo de API key.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { queryClient } from '@/lib/query-client';
import { TenantProvider } from '@/app/tenant-provider';
import { ModelConfigurationsPage } from './ModelConfigurationsPage';
import { setSessionRepository, setSnapshotStore, setServices, getServices } from '@/services/service-container';
import { MemorySnapshotStore } from '@/services/data/snapshot-store';
import { MockSessionRepository } from '@/services/session/mock-session-repository';
import { buildSeed } from '@/domain/seed';
import { FakeAgentsRepository, makeConfig } from '@/features/agents/fake-agents-repository';
import '@/i18n';

function wrap(ui: React.ReactNode) {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/model-configurations']}>
        <TenantProvider>{ui}</TenantProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
function install(fake: FakeAgentsRepository) { setServices({ ...getServices(), agents: fake }); }

beforeEach(() => {
  cleanup();
  queryClient.clear();
  setSnapshotStore(new MemorySnapshotStore(buildSeed()));
  setServices(null);
  localStorage.clear();
  sessionStorage.clear();
});

describe('ModelConfigurationsPage', () => {
  it('provider interno é marcado "Somente teste"', async () => {
    setSessionRepository(new MockSessionRepository('many_orgs'));
    install(new FakeAgentsRepository());
    wrap(<ModelConfigurationsPage />);
    expect(await screen.findByText(/somente teste|test only/i)).toBeInTheDocument();
  });

  it('configuração ACTIVE oferece suspender; chama o comando do backend', async () => {
    setSessionRepository(new MockSessionRepository('many_orgs'));
    const fake = new FakeAgentsRepository();
    fake.configs = [makeConfig({ status: 'ACTIVE', name: 'Config Alpha' })];
    let suspended = false;
    const orig = fake.suspendModelConfiguration.bind(fake);
    fake.suspendModelConfiguration = async (id, body) => { suspended = true; return orig(id, body); };
    install(fake);
    wrap(<ModelConfigurationsPage />);

    expect(await screen.findByText('Config Alpha')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /suspender|suspend/i }));
    await waitFor(() => expect(suspended).toBe(true));
  });

  it('formulário de criação NÃO tem campo de API key', async () => {
    setSessionRepository(new MockSessionRepository('many_orgs'));
    install(new FakeAgentsRepository());
    wrap(<ModelConfigurationsPage />);
    fireEvent.click(await screen.findByRole('button', { name: /nova configuração|new configuration/i }));
    await screen.findByText(/sem provider comercial|no commercial provider/i);
    expect(screen.queryByLabelText(/api key/i)).not.toBeInTheDocument();
  });
});
