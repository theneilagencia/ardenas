/**
 * Arden.AS — teste de componente da lista de agentes (ARDEN-BE-007.7 §11–12, §46).
 * Lista real via API; ação de criação gated por permissão; estados vazio/erro.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { queryClient } from '@/lib/query-client';
import { TenantProvider } from '@/app/tenant-provider';
import { AgentsPage } from './AgentsPage';
import { setSessionRepository, setSnapshotStore, setServices, getServices } from '@/services/service-container';
import { MemorySnapshotStore } from '@/services/data/snapshot-store';
import { MockSessionRepository } from '@/services/session/mock-session-repository';
import { buildSeed } from '@/domain/seed';
import { FakeAgentsRepository, makeAgent } from './fake-agents-repository';
import '@/i18n';

function wrap(ui: React.ReactNode) {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/agents']}>
        <TenantProvider>{ui}</TenantProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
function install(fake: FakeAgentsRepository) {
  setServices({ ...getServices(), agents: fake });
}

beforeEach(() => {
  cleanup();
  queryClient.clear();
  setSnapshotStore(new MemorySnapshotStore(buildSeed()));
  setServices(null);
  localStorage.clear();
  sessionStorage.clear();
});

describe('AgentsPage — lista real via API', () => {
  it('renderiza os agentes retornados pela API', async () => {
    setSessionRepository(new MockSessionRepository('many_orgs'));
    const fake = new FakeAgentsRepository();
    fake.agents = [makeAgent({ name: 'Classificador de leads', key: 'lead-classifier' })];
    install(fake);
    wrap(<AgentsPage />);
    expect(await screen.findByText('Classificador de leads')).toBeInTheDocument();
    expect(screen.getByText('lead-classifier')).toBeInTheDocument();
  });

  it('estado vazio quando a API não retorna agentes', async () => {
    setSessionRepository(new MockSessionRepository('many_orgs'));
    const fake = new FakeAgentsRepository();
    fake.agents = [];
    install(fake);
    wrap(<AgentsPage />);
    expect(await screen.findByText(/Nada por aqui ainda\.|Nothing here yet\./i)).toBeInTheDocument();
  });

  it('botão de criação exige permissão (corporate_admin possui agent.create)', async () => {
    setSessionRepository(new MockSessionRepository('many_orgs'));
    install(new FakeAgentsRepository());
    wrap(<AgentsPage />);
    expect(await screen.findByRole('button', { name: /novo agente|new agent/i })).toBeInTheDocument();
  });
});
