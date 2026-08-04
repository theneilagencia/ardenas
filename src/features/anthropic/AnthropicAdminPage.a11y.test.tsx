/**
 * Arden.AS — a11y da página de administração Anthropic (ARDEN-BE-008.6 §46).
 * Estados por texto+ícone (não só cor); landmarks e cabeçalhos acessíveis. Sem rede.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import axe from 'axe-core';
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

beforeEach(() => {
  cleanup();
  queryClient.clear();
  setSnapshotStore(new MemorySnapshotStore(buildSeed()));
  setServices(null);
  setSessionRepository(new MockSessionRepository('many_orgs'));
  const fake = new FakeAgentsRepository();
  fake.providers = [makeProvider({ key: 'anthropic.direct', name: 'Anthropic', status: 'DISABLED', productionAllowed: false, capabilities: ['STRUCTURED_OUTPUT', 'TOOL_CALLING'] })];
  setServices({ ...getServices(), agents: fake });
});

describe('AnthropicAdminPage a11y', () => {
  it('sem violações de acessibilidade', async () => {
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/anthropic']}>
          <TenantProvider><AnthropicAdminPage /></TenantProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    await screen.findByText(/Estados de verificação/i);
    const results = await axe.run(container, { rules: { region: { enabled: false } } });
    const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    expect(serious, JSON.stringify(serious.map((v) => v.id))).toHaveLength(0);
  });
});
