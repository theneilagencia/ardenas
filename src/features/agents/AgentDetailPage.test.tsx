/**
 * Arden.AS — teste do detalhe do agente: lifecycle e read-only (ARDEN-BE-007.7 §13, §46).
 * Ações de estado usam comandos do backend; REVOKED é somente leitura.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { queryClient } from '@/lib/query-client';
import { TenantProvider } from '@/app/tenant-provider';
import { AgentDetailPage } from './AgentDetailPage';
import { setSessionRepository, setSnapshotStore, setServices, getServices } from '@/services/service-container';
import { MemorySnapshotStore } from '@/services/data/snapshot-store';
import { MockSessionRepository } from '@/services/session/mock-session-repository';
import { buildSeed } from '@/domain/seed';
import { FakeAgentsRepository, makeAgent } from './fake-agents-repository';
import '@/i18n';

function wrap(path = '/agents/ag1') {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <TenantProvider>
          <Routes>
            <Route path="/agents/:agentId" element={<AgentDetailPage />} />
          </Routes>
        </TenantProvider>
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
  vi.restoreAllMocks();
});

describe('AgentDetailPage — lifecycle', () => {
  it('agente ACTIVE → suspender chama o comando do backend', async () => {
    setSessionRepository(new MockSessionRepository('many_orgs'));
    const fake = new FakeAgentsRepository();
    fake.agents = [makeAgent({ id: 'ag1', status: 'ACTIVE' })];
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    let called = false;
    const orig = fake.suspendAgent.bind(fake);
    fake.suspendAgent = async (id, body) => { called = true; return orig(id, body); };
    install(fake);
    wrap();
    fireEvent.click(await screen.findByRole('button', { name: /^Suspender$|^Suspend$/ }));
    await waitFor(() => expect(called).toBe(true));
  });

  it('agente REVOKED → somente leitura (sem ações de lifecycle)', async () => {
    setSessionRepository(new MockSessionRepository('many_orgs'));
    const fake = new FakeAgentsRepository();
    fake.agents = [makeAgent({ id: 'ag1', status: 'REVOKED' })];
    install(fake);
    wrap();
    await screen.findAllByText(/Revogado|Revoked/i);
    expect(screen.queryByRole('button', { name: /^Suspender$|^Suspend$|^Revogar$|^Revoke$/ })).not.toBeInTheDocument();
  });
});
