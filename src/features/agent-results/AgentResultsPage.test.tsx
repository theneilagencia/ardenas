/**
 * Arden.AS — teste de componente dos resultados de agentes (ARDEN-BE-007.7 §33, §52).
 * CRÍTICO: custo 0 conhecido mostra "0,00"; custo null mostra "não disponível" —
 * nunca confundidos. Estados de erro/vazio. Sem recálculo no browser.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { queryClient } from '@/lib/query-client';
import { TenantProvider } from '@/app/tenant-provider';
import { AgentResultsPage } from './AgentResultsPage';
import { setSessionRepository, setSnapshotStore, setServices, getServices } from '@/services/service-container';
import { MemorySnapshotStore } from '@/services/data/snapshot-store';
import { MockSessionRepository } from '@/services/session/mock-session-repository';
import { buildSeed } from '@/domain/seed';
import { FakeAgentsRepository, makeResult } from '@/features/agents/fake-agents-repository';
import '@/i18n';

function wrap(ui: React.ReactNode) {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/agent-results']}>
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

describe('AgentResultsPage — custo conhecido vs indisponível', () => {
  it('custo 0 conhecido → exibe "0,00" (NUNCA "não disponível")', async () => {
    setSessionRepository(new MockSessionRepository('many_orgs'));
    const fake = new FakeAgentsRepository();
    fake.results = [makeResult({ costSummary: { estimatedCostMinor: 0, currency: 'USD', rateCardId: 'rc1', warningCode: null } })];
    install(fake);
    wrap(<AgentResultsPage />);
    expect(await screen.findByText(/0,00/)).toBeInTheDocument();
    expect(screen.queryByText(/não disponível|unavailable/i)).not.toBeInTheDocument();
  });

  it('custo null → exibe "Custo não disponível" (NUNCA "0,00")', async () => {
    setSessionRepository(new MockSessionRepository('many_orgs'));
    const fake = new FakeAgentsRepository();
    fake.results = [makeResult({ costSummary: { estimatedCostMinor: null, currency: null, rateCardId: null, warningCode: 'COST_RATE_CARD_NOT_AVAILABLE' } })];
    install(fake);
    wrap(<AgentResultsPage />);
    expect(await screen.findByText(/não disponível|unavailable/i)).toBeInTheDocument();
    expect(screen.queryByText(/0,00/)).not.toBeInTheDocument();
  });

  it('estado de erro com retry', async () => {
    setSessionRepository(new MockSessionRepository('many_orgs'));
    const fake = new FakeAgentsRepository();
    fake.failListResults = true;
    install(fake);
    wrap(<AgentResultsPage />);
    expect(await screen.findByRole('alert', {}, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again|tentar novamente/i })).toBeInTheDocument();
  });
});
