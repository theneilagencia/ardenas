/**
 * Arden.AS — teste da página de administração Anthropic (ARDEN-BE-008.6 §8/§9/§25/§38/§39/§49).
 * Provider real da API (fake repo); comprova visibilidade dos estados NÃO resumíveis: produção
 * bloqueada, preço/governança não verificados, smoke não executado, tool calling offline. Sem
 * segredo (a página não coleta credencial). Sem rede.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { queryClient } from '@/lib/query-client';
import { TenantProvider } from '@/app/tenant-provider';
import { AnthropicAdminPage } from './AnthropicAdminPage';
import { setSessionRepository, setSnapshotStore, setServices, getServices } from '@/services/service-container';
import { MemorySnapshotStore } from '@/services/data/snapshot-store';
import { MockSessionRepository } from '@/services/session/mock-session-repository';
import { buildSeed } from '@/domain/seed';
import { FakeAgentsRepository, makeProvider } from '@/features/agents/fake-agents-repository';
import '@/i18n';

function wrap(ui: React.ReactNode) {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/anthropic']}>
        <TenantProvider>{ui}</TenantProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
function install(providers = anthropicProviders()) {
  const fake = new FakeAgentsRepository();
  fake.providers = providers;
  setServices({ ...getServices(), agents: fake });
}
function anthropicProviders() {
  return [makeProvider({ key: 'anthropic.direct', name: 'Anthropic', status: 'DISABLED', productionAllowed: false, capabilities: ['STRUCTURED_OUTPUT', 'TOOL_CALLING'] })];
}

beforeEach(() => {
  cleanup();
  queryClient.clear();
  setSnapshotStore(new MemorySnapshotStore(buildSeed()));
  setServices(null);
  localStorage.clear();
  sessionStorage.clear();
  setSessionRepository(new MockSessionRepository('many_orgs'));
});

describe('AnthropicAdminPage', () => {
  it('mostra o provider e o banner de produção bloqueada', async () => {
    install();
    wrap(<AnthropicAdminPage />);
    expect(await screen.findByText(/Uso em produção bloqueado/i)).toBeInTheDocument();
    expect(screen.getByText('anthropic.direct')).toBeInTheDocument();
    expect(screen.getByText('TOOL_CALLING')).toBeInTheDocument();
  });

  it('produção bloqueada permanece visível mesmo com o provider DISABLED', async () => {
    install();
    wrap(<AnthropicAdminPage />);
    // productionAllowed=false → "Não"
    expect(await screen.findByText(/Disponível em produção/i)).toBeInTheDocument();
    expect(screen.getByText('Não')).toBeInTheDocument();
  });

  it('mostra preço e governança NÃO VERIFICADOS e smoke NÃO EXECUTADO', async () => {
    install();
    wrap(<AnthropicAdminPage />);
    await screen.findByText(/Estados de verificação/i);
    expect(screen.getAllByText(/Preço oficial/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Governança de dados/i)).toBeInTheDocument();
    expect(screen.getByText(/Smoke test real/i)).toBeInTheDocument();
    expect(screen.getByText(/Não executado/i)).toBeInTheDocument();
    // ≥2 "Não verificado" (preço + governança)
    expect(screen.getAllByText(/Não verificado/i).length).toBeGreaterThanOrEqual(2);
  });

  it('tool calling é apresentado como validado OFFLINE (não ao vivo)', async () => {
    install();
    wrap(<AnthropicAdminPage />);
    await screen.findByText(/Estados de verificação/i);
    expect(screen.getByText(/Validado offline/i)).toBeInTheDocument();
    // Nunca afirma tool calling ao vivo/verificado
    expect(screen.queryByText(/ao vivo validado|live validated/i)).toBeNull();
  });

  it('estado not-found quando o provider Anthropic não está no catálogo', async () => {
    install([makeProvider({ key: 'internal.test-model' })]);
    wrap(<AnthropicAdminPage />);
    await waitFor(() => expect(screen.getByText(/não encontrado/i)).toBeInTheDocument(), { timeout: 3000 });
  });
});
