/**
 * Arden.AS — teste do painel de uso da execução (ARDEN-BE-008.6 §17).
 * Prova: provider/modelo exibidos; Anthropic marca "Validado offline"; custo
 * desconhecido (null) → "não disponível" (NUNCA 0,00); custo zero conhecido
 * (teste interno) → "US$ 0,00". Sem rede.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { queryClient } from '@/lib/query-client';
import { TenantProvider } from '@/app/tenant-provider';
import { ExecutionAgentUsagePanel } from './ExecutionAgentUsagePanel';
import { setSessionRepository, setSnapshotStore, setServices, getServices } from '@/services/service-container';
import { MemorySnapshotStore } from '@/services/data/snapshot-store';
import { MockSessionRepository } from '@/services/session/mock-session-repository';
import { buildSeed } from '@/domain/seed';
import { FakeAgentsRepository, makeResult } from '@/features/agents/fake-agents-repository';
import type { AgentOperationalResult } from '@/contracts';
import { ANTHROPIC_PROVIDER_KEY } from '@/contracts';
import '@/i18n';

function wrap(results: AgentOperationalResult[]) {
  const fake = new FakeAgentsRepository();
  fake.results = results;
  setServices({ ...getServices(), agents: fake });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <TenantProvider><ExecutionAgentUsagePanel executionRunId="run1" /></TenantProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  cleanup();
  queryClient.clear();
  setSnapshotStore(new MemorySnapshotStore(buildSeed()));
  setServices(null);
  setSessionRepository(new MockSessionRepository('many_orgs'));
});

describe('ExecutionAgentUsagePanel (§17)', () => {
  it('mostra provider/modelo e marca Anthropic como validado offline', async () => {
    wrap([makeResult({
      id: 'r_ant',
      usageSummary: { providerKey: ANTHROPIC_PROVIDER_KEY, modelId: 'claude-opus-4-5-20251101', modelCallCount: 1, toolCallCount: 0, turnCount: 1, repairAttemptCount: 0, approvalCount: 0, securitySignalCount: 0, inputTokens: 10, outputTokens: 5, cachedInputTokens: 0, cachedOutputTokens: 0, durationMs: 10 },
      costSummary: { estimatedCostMinor: null, currency: null, rateCardId: null, warningCode: null },
    })]);
    await waitFor(() => expect(screen.getByText('claude-opus-4-5-20251101')).toBeInTheDocument(), { timeout: 3000 });
    expect(screen.getByText(ANTHROPIC_PROVIDER_KEY)).toBeInTheDocument();
    expect(screen.getByText(/Validado offline/i)).toBeInTheDocument();
  });

  it('custo desconhecido (null) aparece como "não disponível", nunca 0,00', async () => {
    wrap([makeResult({
      id: 'r_null',
      costSummary: { estimatedCostMinor: null, currency: null, rateCardId: null, warningCode: null },
    })]);
    await waitFor(() => expect(screen.getByText(/não disponível/i)).toBeInTheDocument(), { timeout: 3000 });
    expect(screen.queryByText(/0,00|0\.00/)).toBeNull();
  });

  it('custo zero conhecido (teste interno) é formatado como US$ 0,00', async () => {
    wrap([makeResult({
      id: 'r_zero',
      costSummary: { estimatedCostMinor: 0, currency: 'USD', rateCardId: 'rc1', warningCode: null },
    })]);
    await waitFor(() => expect(screen.getByText(/0,00/)).toBeInTheDocument(), { timeout: 3000 });
    expect(screen.queryByText(/não disponível/i)).toBeNull();
  });
});
