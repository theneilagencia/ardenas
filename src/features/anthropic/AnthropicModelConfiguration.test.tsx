/**
 * Arden.AS — teste da configuração de modelo Anthropic guiada (ARDEN-BE-008.6 §13–§15).
 * Prova: provider fixo anthropic.direct; modelId só do catálogo (allowlist), DISABLED
 * não selecionável; criação em DRAFT; ativação BLOQUEADA (elegibilidade backend).
 * Sem rede.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { queryClient } from '@/lib/query-client';
import { TenantProvider } from '@/app/tenant-provider';
import { AnthropicModelConfiguration } from './AnthropicModelConfiguration';
import { setSessionRepository, setSnapshotStore, setServices, getServices } from '@/services/service-container';
import { MemorySnapshotStore } from '@/services/data/snapshot-store';
import { MockSessionRepository } from '@/services/session/mock-session-repository';
import { buildSeed } from '@/domain/seed';
import { FakeAgentsRepository, makeProvider, makeConfig } from '@/features/agents/fake-agents-repository';
import { FakeConnectorsRepository, makeActiveConnection } from '@/features/integrations/fake-connectors-repository';
import type { ModelCatalogEntry, CreateModelConfigurationRequest, ModelConfiguration } from '@/contracts';
import { ANTHROPIC_PROVIDER_KEY, ANTHROPIC_PROVIDER_VERSION, ANTHROPIC_CONNECTOR_KEY } from '@/contracts';
import '@/i18n';

function entry(over: Partial<ModelCatalogEntry> = {}): ModelCatalogEntry {
  return {
    providerKey: ANTHROPIC_PROVIDER_KEY, providerVersion: ANTHROPIC_PROVIDER_VERSION,
    modelId: 'claude-opus-4-5-20251101', displayName: 'Claude Opus 4.5', status: 'DISABLED',
    productionAllowed: false, capabilities: ['STRUCTURED_OUTPUT'], maximumInputTokens: null, maximumOutputTokens: null,
    supportsStructuredOutput: true, supportsToolCalling: true, supportsPromptCaching: true, supportsVision: false,
    supportsStreaming: true, rateCardKey: null, sourceReferences: ['sdk'], ...over,
  };
}

class CapturingAgents extends FakeAgentsRepository {
  lastCreate: CreateModelConfigurationRequest | null = null;
  override async createModelConfiguration(body: CreateModelConfigurationRequest): Promise<ModelConfiguration> {
    this.lastCreate = body;
    return makeConfig({ id: 'cfg_new', providerKey: body.providerKey, modelId: body.modelId, status: 'DRAFT' });
  }
}

function install(opts: { catalog: ModelCatalogEntry[]; configs?: ModelConfiguration[] }) {
  const agents = new CapturingAgents();
  agents.catalog = opts.catalog;
  agents.providers = [makeProvider({ key: ANTHROPIC_PROVIDER_KEY, name: 'Anthropic', status: 'DISABLED', productionAllowed: false })];
  agents.configs = opts.configs ?? [];
  const connectors = new FakeConnectorsRepository([
    makeActiveConnection({ id: 'conn_a', name: 'Anthropic conn', connectorKey: ANTHROPIC_CONNECTOR_KEY, status: 'ACTIVE' }),
  ]);
  setServices({ ...getServices(), agents, connectors });
  return { agents, connectors };
}

function wrap() {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <TenantProvider><AnthropicModelConfiguration /></TenantProvider>
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

describe('AnthropicModelConfiguration', () => {
  it('provider é fixo e a ativação aparece bloqueada', async () => {
    install({ catalog: [entry({ status: 'ACTIVE', productionAllowed: false })] });
    wrap();
    await waitFor(() => expect(screen.getByText(/Configuração de modelo Anthropic/i)).toBeInTheDocument(), { timeout: 3000 });
    expect(screen.getAllByText(new RegExp(ANTHROPIC_PROVIDER_KEY.replace('.', '\\.'), 'i')).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Ativação bloqueada nesta fase/i)).toBeInTheDocument();
  });

  it('modelos DISABLED não são selecionáveis; só o catálogo alimenta o select', async () => {
    install({ catalog: [entry({ modelId: 'claude-opus-4-5-20251101', status: 'DISABLED' })] });
    wrap();
    await waitFor(() => expect(screen.getByText(/Nenhum modelo selecionável/i)).toBeInTheDocument(), { timeout: 3000 });
    // O ID DISABLED não aparece como opção selecionável.
    const select = screen.getByLabelText(/^Modelo$/i) as HTMLSelectElement;
    const options = Array.from(select.options).map((o) => o.value).filter(Boolean);
    expect(options).toHaveLength(0);
  });

  it('cria configuração em DRAFT com provider anthropic.direct e modelId do catálogo', async () => {
    const { agents } = install({ catalog: [entry({ modelId: 'claude-sonnet-4-5-20250929', displayName: 'Sonnet 4.5', status: 'ACTIVE' })] });
    wrap();
    const user = userEvent.setup();
    await waitFor(() => expect(screen.getByLabelText(/^Nome$/i)).toBeInTheDocument(), { timeout: 3000 });

    await user.type(screen.getByLabelText(/^Nome$/i), 'Config Anthropic');
    await user.selectOptions(screen.getByLabelText(/^Modelo$/i), 'claude-sonnet-4-5-20250929');
    await user.click(screen.getByRole('button', { name: /Criar configuração/i }));

    await waitFor(() => expect(agents.lastCreate).not.toBeNull(), { timeout: 3000 });
    expect(agents.lastCreate?.providerKey).toBe(ANTHROPIC_PROVIDER_KEY);
    expect(agents.lastCreate?.providerVersion).toBe(ANTHROPIC_PROVIDER_VERSION);
    expect(agents.lastCreate?.modelId).toBe('claude-sonnet-4-5-20250929');
    expect(screen.getByText(/Configuração criada em rascunho/i)).toBeInTheDocument();
  });

  it('configurações existentes mostram ativação bloqueada', async () => {
    install({
      catalog: [entry({ status: 'ACTIVE' })],
      configs: [makeConfig({ id: 'cfg1', providerKey: ANTHROPIC_PROVIDER_KEY, modelId: 'claude-opus-4-5-20251101', name: 'Existente', status: 'DRAFT' })],
    });
    wrap();
    await waitFor(() => expect(screen.getByText('Existente')).toBeInTheDocument(), { timeout: 3000 });
    expect(screen.getAllByText(/Ativação bloqueada/i).length).toBeGreaterThanOrEqual(1);
  });
});
