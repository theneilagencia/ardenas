/**
 * Arden.AS — teste das conexões Anthropic seguras (ARDEN-BE-008.6 §7–§12/§38/§39).
 *
 * Prova as invariantes de segurança:
 * - API key write-only: enviada uma vez, some do formulário, NUNCA no DOM/storage
 *   após o envio (canário de segredo).
 * - Connector e base URL fixos (system.anthropic + oficial).
 * - Validação LOCAL mostra NÃO VERIFICADO COM O PROVIDER; nunca "conectado".
 * - Smoke test é CLI-only: sem botão que dispare de fato.
 * - Rotação invalida o smoke anterior.
 * Sem rede.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, cleanup, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { queryClient } from '@/lib/query-client';
import { TenantProvider } from '@/app/tenant-provider';
import { AnthropicConnections } from './AnthropicConnections';
import { setSessionRepository, setSnapshotStore, setServices, getServices } from '@/services/service-container';
import { MemorySnapshotStore } from '@/services/data/snapshot-store';
import { MockSessionRepository } from '@/services/session/mock-session-repository';
import { buildSeed } from '@/domain/seed';
import { FakeConnectorsRepository, makeActiveConnection } from '@/features/integrations/fake-connectors-repository';
import { ANTHROPIC_CONNECTOR_KEY } from '@/contracts';
import '@/i18n';

const SECRET = 'sk-ant-secret-CANARY-8f3a2b1c';

function seedRepo(): FakeConnectorsRepository {
  const repo = new FakeConnectorsRepository([
    makeActiveConnection({ id: 'conn_anthropic', name: 'Anthropic prod-prep', connectorKey: ANTHROPIC_CONNECTOR_KEY, status: 'ACTIVE' }),
  ]);
  setServices({ ...getServices(), connectors: repo });
  return repo;
}

function wrap() {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <TenantProvider><AnthropicConnections /></TenantProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
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

describe('AnthropicConnections', () => {
  it('connector e base URL são fixos e oficiais', async () => {
    seedRepo();
    wrap();
    await waitFor(() => expect(screen.getByText(/Conexões Anthropic/i)).toBeInTheDocument(), { timeout: 3000 });
    expect(screen.getAllByText(new RegExp(ANTHROPIC_CONNECTOR_KEY.replace('.', '\\.'), 'i')).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/api\.anthropic\.com/i)).toBeInTheDocument();
  });

  it('cria conexão com API key write-only e o segredo NUNCA persiste no DOM/storage', async () => {
    const repo = seedRepo();
    wrap();
    const user = userEvent.setup();
    await waitFor(() => expect(screen.getByLabelText(/^Nome$/i)).toBeInTheDocument(), { timeout: 3000 });

    await user.type(screen.getByLabelText(/^Nome$/i), 'Nova conexão');
    await user.type(screen.getByLabelText(/API key/i), SECRET);
    await user.click(screen.getByRole('button', { name: /Criar conexão Anthropic/i }));

    // O segredo chegou ao repositório na forma { apiKey } — e só uma vez.
    await waitFor(() => expect(repo.lastCredentialSecret).toEqual({ apiKey: SECRET }), { timeout: 3000 });

    // Canário: o segredo não aparece em nenhum lugar visível/persistente após o envio.
    expect(document.body.innerHTML).not.toContain(SECRET);
    expect(JSON.stringify(localStorage)).not.toContain(SECRET);
    expect(JSON.stringify(sessionStorage)).not.toContain(SECRET);
    // O campo foi limpo.
    expect((screen.getByLabelText(/API key/i) as HTMLInputElement).value).toBe('');
  });

  it('validação LOCAL mostra NÃO VERIFICADO COM O PROVIDER e nunca "conectado"', async () => {
    seedRepo();
    wrap();
    const user = userEvent.setup();
    await waitFor(() => expect(screen.getByText('Anthropic prod-prep')).toBeInTheDocument(), { timeout: 3000 });
    await user.click(screen.getByText('Anthropic prod-prep'));
    await user.click(await screen.findByRole('button', { name: /Validar configuração/i }));

    await waitFor(() => expect(screen.getByText(/NÃO VERIFICADO COM O PROVIDER/i)).toBeInTheDocument(), { timeout: 3000 });
    // Só fingerprint, nunca a key.
    expect(screen.getByText('fp-1234')).toBeInTheDocument();
    expect(screen.queryByText(/\bconectado\b|autenticado|válido perante/i)).toBeNull();
  });

  it('smoke test é CLI-only: sem gatilho e estado "Não executado"', async () => {
    seedRepo();
    wrap();
    const user = userEvent.setup();
    await waitFor(() => expect(screen.getByText('Anthropic prod-prep')).toBeInTheDocument(), { timeout: 3000 });
    await user.click(screen.getByText('Anthropic prod-prep'));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/Não executado/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/SOMENTE por CLI/i)).toBeInTheDocument();
    // Nenhum botão que "execute/rode/dispare" o smoke.
    const buttons = within(dialog).getAllByRole('button').map((b) => b.textContent ?? '');
    expect(buttons.some((label) => /executar smoke|rodar smoke|disparar smoke|run smoke/i.test(label))).toBe(false);
  });

  it('rotação de credencial invalida o smoke anterior', async () => {
    seedRepo();
    wrap();
    const user = userEvent.setup();
    await waitFor(() => expect(screen.getByText('Anthropic prod-prep')).toBeInTheDocument(), { timeout: 3000 });
    await user.click(screen.getByText('Anthropic prod-prep'));

    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText(/Nova API key/i), 'sk-ant-rotated-XYZ');
    await user.click(within(dialog).getByRole('button', { name: /Rotacionar credencial/i }));

    await waitFor(() => expect(within(dialog).getByText(/Invalidado pela rotação/i)).toBeInTheDocument(), { timeout: 3000 });
    // A key rotacionada também não persiste no DOM.
    expect(document.body.innerHTML).not.toContain('sk-ant-rotated-XYZ');
  });
});
