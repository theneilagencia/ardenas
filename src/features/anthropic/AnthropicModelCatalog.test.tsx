/**
 * Arden.AS — teste do catálogo de modelos Anthropic (ARDEN-BE-008.6 §5).
 * Prova: IDs vêm do backend (fake repo), modelos DISABLED aparecem não
 * selecionáveis, limites null → "Limite não verificado", preço sem rate card →
 * "Preço não verificado". Sem catálogo hardcoded na UI. Sem rede.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { queryClient } from '@/lib/query-client';
import { TenantProvider } from '@/app/tenant-provider';
import { AnthropicModelCatalog } from './AnthropicModelCatalog';
import { setSessionRepository, setSnapshotStore, setServices, getServices } from '@/services/service-container';
import { MemorySnapshotStore } from '@/services/data/snapshot-store';
import { MockSessionRepository } from '@/services/session/mock-session-repository';
import { buildSeed } from '@/domain/seed';
import { FakeAgentsRepository } from '@/features/agents/fake-agents-repository';
import type { ModelCatalogEntry } from '@/contracts';
import { ANTHROPIC_PROVIDER_KEY, ANTHROPIC_PROVIDER_VERSION } from '@/contracts';
import '@/i18n';

function entry(over: Partial<ModelCatalogEntry> = {}): ModelCatalogEntry {
  return {
    providerKey: ANTHROPIC_PROVIDER_KEY,
    providerVersion: ANTHROPIC_PROVIDER_VERSION,
    modelId: 'claude-opus-4-5-20251101',
    displayName: 'Claude Opus 4.5',
    status: 'DISABLED',
    productionAllowed: false,
    capabilities: ['STRUCTURED_OUTPUT', 'TOOL_CALLING'],
    maximumInputTokens: null,
    maximumOutputTokens: null,
    supportsStructuredOutput: true,
    supportsToolCalling: true,
    supportsPromptCaching: true,
    supportsVision: false,
    supportsStreaming: true,
    rateCardKey: null,
    sourceReferences: ['sdk'],
    ...over,
  };
}

function wrap(catalog: ModelCatalogEntry[]) {
  const fake = new FakeAgentsRepository();
  fake.catalog = catalog;
  setServices({ ...getServices(), agents: fake });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <TenantProvider><AnthropicModelCatalog /></TenantProvider>
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

describe('AnthropicModelCatalog', () => {
  it('mostra modelId do backend e marca DISABLED como não selecionável', async () => {
    wrap([entry({ modelId: 'claude-opus-4-5-20251101', status: 'DISABLED', productionAllowed: false })]);
    await waitFor(() => expect(screen.getByText('claude-opus-4-5-20251101')).toBeInTheDocument(), { timeout: 3000 });
    expect(screen.getByText(/Não disponível/i)).toBeInTheDocument();
  });

  it('limites null aparecem como "Limite não verificado" e preço como "Preço não verificado"', async () => {
    wrap([entry({ maximumInputTokens: null, maximumOutputTokens: null, rateCardKey: null })]);
    await waitFor(() => expect(screen.getByText('claude-opus-4-5-20251101')).toBeInTheDocument(), { timeout: 3000 });
    expect(screen.getAllByText(/Limite não verificado/i).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/Preço não verificado/i)).toBeInTheDocument();
  });

  it('não inventa modelos quando o backend devolve catálogo vazio', async () => {
    wrap([]);
    await waitFor(() => expect(screen.getByText(/Nenhum modelo no catálogo/i)).toBeInTheDocument(), { timeout: 3000 });
    expect(screen.queryByText(/claude-/i)).toBeNull();
  });
});
