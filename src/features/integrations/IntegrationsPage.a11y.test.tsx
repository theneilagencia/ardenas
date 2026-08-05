import { beforeEach, describe, expect, it } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import axe from 'axe-core';
import { queryClient } from '@/lib/query-client';
import { TenantProvider } from '@/app/tenant-provider';
import { IntegrationsPage } from './IntegrationsPage';
import { setSessionRepository, setSnapshotStore, setServices, getServices } from '@/services/service-container';
import { MemorySnapshotStore } from '@/services/data/snapshot-store';
import { MockSessionRepository } from '@/services/session/mock-session-repository';
import { buildSeed } from '@/domain/seed';
import { FakeConnectorsRepository, makeActiveConnection } from './fake-connectors-repository';
import '@/i18n';

beforeEach(() => {
  cleanup();
  queryClient.clear();
  setSnapshotStore(new MemorySnapshotStore(buildSeed()));
  setServices(null);
});

async function waitForSettled() {
  // Deixa as consultas iniciais (catálogo/conexões) resolverem antes do axe rodar.
  await new Promise((r) => setTimeout(r, 0));
  await new Promise((r) => setTimeout(r, 0));
}

describe('acessibilidade — Integrações', () => {
  it('não tem violações de axe (regras críticas e sérias)', async () => {
    setSessionRepository(new MockSessionRepository('many_orgs'));
    setServices({
      ...getServices(),
      connectors: new FakeConnectorsRepository([makeActiveConnection({ name: 'Conexão de exemplo' })]),
    });

    const { container, findByText } = render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/integrations']}>
          <TenantProvider>
            <IntegrationsPage />
          </TenantProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await findByText('HTTP REST');
    await waitForSettled();

    const results = await axe.run(container, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] },
    });
    const serious = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious',
    );
    expect(serious, JSON.stringify(serious.map((v) => v.id))).toHaveLength(0);
  });
});
