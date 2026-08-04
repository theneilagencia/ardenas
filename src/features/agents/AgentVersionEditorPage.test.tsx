/**
 * Arden.AS — teste do editor de versão (ARDEN-BE-007.7 §53 publicada read-only, §51 canário).
 * CRÍTICO: versão PUBLICADA é somente leitura (sem PATCH); a UI oferece "criar nova versão".
 * CRÍTICO: instrução/canário NUNCA vaza para localStorage/sessionStorage.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { queryClient } from '@/lib/query-client';
import { TenantProvider } from '@/app/tenant-provider';
import { AgentVersionEditorPage } from './AgentVersionEditorPage';
import { setSessionRepository, setSnapshotStore, setServices, getServices } from '@/services/service-container';
import { MemorySnapshotStore } from '@/services/data/snapshot-store';
import { MockSessionRepository } from '@/services/session/mock-session-repository';
import { buildSeed } from '@/domain/seed';
import { FakeAgentsRepository, makeVersion, makeConfig } from './fake-agents-repository';
import { ANTHROPIC_PROVIDER_KEY } from '@/contracts';
import '@/i18n';

const CANARY = 'ARDEN_BE007_FRONTEND_INSTRUCTION_CANARY_9f2c';

function wrap(path: string) {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <TenantProvider>
          <Routes>
            <Route path="/agents/:agentId/versions/:agentVersionId" element={<AgentVersionEditorPage />} />
          </Routes>
        </TenantProvider>
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

describe('AgentVersionEditorPage — versão publicada é somente leitura (§53)', () => {
  it('versão PUBLISHED → aviso read-only + CTA criar nova versão; sem botão salvar/publicar', async () => {
    setSessionRepository(new MockSessionRepository('many_orgs'));
    const fake = new FakeAgentsRepository();
    fake.versions = [makeVersion({ id: 'v1', status: 'PUBLISHED', systemInstructions: `Instruções ${CANARY}` })];
    install(fake);
    wrap('/agents/ag1/versions/v1');

    expect(await screen.findByText(/imutável|immutable/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /criar nova versão|create new version/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Publicar$|^Publish$/ })).not.toBeInTheDocument();
    // Nenhum PATCH pôde ser enviado (não há salvar rascunho para publicada).
    expect(fake.updateVersionCalls).toBe(0);
  });

  it('canário de instrução NÃO vaza para localStorage/sessionStorage (§51)', async () => {
    setSessionRepository(new MockSessionRepository('many_orgs'));
    const fake = new FakeAgentsRepository();
    fake.versions = [makeVersion({ id: 'v1', status: 'DRAFT', systemInstructions: `Instruções ${CANARY}` })];
    install(fake);
    wrap('/agents/ag1/versions/v1');

    // Aguarda a versão carregar no estado do editor (objetivo visível na visão geral);
    // as instruções (com o canário) ficam SÓ em memória, em qualquer aba.
    await waitFor(() => expect(screen.getByDisplayValue('Classificar leads')).toBeInTheDocument());

    const dump = JSON.stringify({ ls: { ...localStorage }, ss: { ...sessionStorage } });
    expect(dump.includes(CANARY)).toBe(false);
  });

  it('versão Anthropic (DRAFT) mostra aviso offline e bloqueia publicação (§16)', async () => {
    setSessionRepository(new MockSessionRepository('many_orgs'));
    const fake = new FakeAgentsRepository();
    fake.configs = [makeConfig({ id: 'cfg1', providerKey: ANTHROPIC_PROVIDER_KEY, status: 'DRAFT', name: 'Anthropic cfg' })];
    fake.versions = [makeVersion({ id: 'v1', status: 'DRAFT', modelConfigurationId: 'cfg1' })];
    install(fake);
    wrap('/agents/ag1/versions/v1');

    await waitFor(() => expect(screen.getByText(/validados offline/i)).toBeInTheDocument(), { timeout: 3000 });
    expect(screen.getByText(/A chamada real e o tool calling ao vivo ainda não foram comprovados/i)).toBeInTheDocument();
    // Botão publicar existe, porém desabilitado (bloqueado).
    const publishBtn = screen.getByRole('button', { name: /^Publicar$|^Publish$/ });
    expect(publishBtn).toBeDisabled();
  });
});
