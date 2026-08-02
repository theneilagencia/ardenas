import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { queryClient } from '@/lib/query-client';
import { TenantProvider } from '@/app/tenant-provider';
import { IntegrationsPage } from './IntegrationsPage';
import { setSessionRepository, setSnapshotStore, setServices, getServices } from '@/services/service-container';
import { MemorySnapshotStore } from '@/services/data/snapshot-store';
import { MockSessionRepository } from '@/services/session/mock-session-repository';
import { buildSeed } from '@/domain/seed';
import { useAppStore } from '@/store/app-store';
import { FakeConnectorsRepository, makeActiveConnection } from './fake-connectors-repository';
import '@/i18n';

function wrap(ui: React.ReactNode) {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/integrations']}>
        <TenantProvider>{ui}</TenantProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function installFake(fake: FakeConnectorsRepository) {
  setServices({ ...getServices(), connectors: fake });
}

beforeEach(() => {
  cleanup();
  queryClient.clear();
  setSnapshotStore(new MemorySnapshotStore(buildSeed()));
  setServices(null);
  localStorage.clear();
  sessionStorage.clear();
});

describe('IntegrationsPage — catálogo', () => {
  it('renderiza o catálogo de conectores', async () => {
    setSessionRepository(new MockSessionRepository('many_orgs'));
    installFake(new FakeConnectorsRepository());
    wrap(<IntegrationsPage />);

    expect(await screen.findByText('HTTP REST')).toBeInTheDocument();
    expect(screen.getByText('Webhook de saída')).toBeInTheDocument();
  });
});

describe('IntegrationsPage — conexões', () => {
  it('mostra estado vazio quando não há conexões', async () => {
    setSessionRepository(new MockSessionRepository('many_orgs'));
    installFake(new FakeConnectorsRepository());
    wrap(<IntegrationsPage />);

    fireEvent.click(screen.getByRole('tab', { name: /connections|conexões/i }));
    expect(await screen.findByText(/Nothing here yet\.|Nada por aqui ainda\./i)).toBeInTheDocument();
  });

  it('mostra estado de erro com retry', async () => {
    setSessionRepository(new MockSessionRepository('many_orgs'));
    const fake = new FakeConnectorsRepository();
    fake.failListConnections = true;
    installFake(fake);
    wrap(<IntegrationsPage />);

    fireEvent.click(screen.getByRole('tab', { name: /connections|conexões/i }));
    expect(await screen.findByRole('alert', {}, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again|tentar novamente/i })).toBeInTheDocument();
  });

  it('cria uma conexão pelo formulário', async () => {
    setSessionRepository(new MockSessionRepository('many_orgs'));
    const fake = new FakeConnectorsRepository();
    installFake(fake);
    wrap(<IntegrationsPage />);

    fireEvent.click(screen.getByRole('tab', { name: /connections|conexões/i }));
    await screen.findByText(/Nothing here yet\.|Nada por aqui ainda\./i);

    fireEvent.change(screen.getByLabelText(/^Name$|^Nome$/), { target: { value: 'My connection' } });
    fireEvent.change(screen.getByLabelText(/Connector|Conector/), { target: { value: 'system.http' } });
    fireEvent.change(screen.getByPlaceholderText('https://'), { target: { value: 'https://api.example.com' } });

    fireEvent.click(screen.getByRole('button', { name: /Create connection|Criar conexão/ }));

    await waitFor(() => expect(screen.getByText('My connection')).toBeInTheDocument());
    expect(fake.connections).toHaveLength(1);
  });

  it('canário de segredo de credencial não é persistido em lugar nenhum', async () => {
    setSessionRepository(new MockSessionRepository('many_orgs'));
    const fake = new FakeConnectorsRepository();
    installFake(fake);
    const { container } = wrap(<IntegrationsPage />);
    const CANARY = 'ARDEN_BE006_FRONTEND_SECRET_CANARY_1';

    fireEvent.click(screen.getByRole('tab', { name: /connections|conexões/i }));
    await screen.findByText(/Nothing here yet\.|Nada por aqui ainda\./i);

    fireEvent.change(screen.getByLabelText(/^Name$|^Nome$/), { target: { value: 'Secret conn' } });
    fireEvent.change(screen.getByLabelText(/Connector|Conector/), { target: { value: 'system.http' } });
    fireEvent.change(screen.getByPlaceholderText('https://'), { target: { value: 'https://api.example.com' } });
    fireEvent.change(screen.getByLabelText(/Secret value|Valor do segredo/), { target: { value: CANARY } });

    fireEvent.click(screen.getByRole('button', { name: /Create connection|Criar conexão/ }));

    await waitFor(() => expect(screen.getByText('Secret conn')).toBeInTheDocument());
    // O caso de uso repassou o segredo ao repositório (não foi perdido)...
    expect(JSON.stringify(fake.lastCredentialSecret)).toContain(CANARY);
    // ...mas não sobrevive em nenhum estado observável pela UI.
    expect(container.innerHTML).not.toContain(CANARY);
    expect(JSON.stringify(localStorage)).not.toContain(CANARY);
    expect(JSON.stringify(sessionStorage)).not.toContain(CANARY);
    expect(JSON.stringify(useAppStore.getState())).not.toContain(CANARY);
    expect(JSON.stringify(queryClient.getQueryCache().getAll().map((q) => q.state.data))).not.toContain(CANARY);
  });

  it('conflito de revisão (409) recarrega o recurso e não sobrescreve silenciosamente', async () => {
    setSessionRepository(new MockSessionRepository('many_orgs'));
    const fake = new FakeConnectorsRepository([makeActiveConnection({ id: 'conn_x', name: 'Conflitante', revision: 1 })]);
    installFake(fake);
    wrap(<IntegrationsPage />);

    fireEvent.click(screen.getByRole('tab', { name: /connections|conexões/i }));
    fireEvent.click(await screen.findByText('Conflitante'));

    // Simula uma mudança concorrente (outra sessão) antes do comando chegar.
    await waitFor(() => expect(fake.connections[0].revision).toBe(1));
    fake.connections[0].revision = 2;

    fireEvent.click(await screen.findByRole('button', { name: /^Suspend$|^Suspender$/ }));

    await screen.findByText(/changed concurrently|mudou concorrentemente/i);
    // O estado final reflete o servidor (ainda ACTIVE) — não foi sobrescrito.
    expect(fake.connections[0].status).toBe('ACTIVE');
  });

  it('esconde a ação de criar conexão sem a permissão connection.create', async () => {
    setSessionRepository(new MockSessionRepository('one_org'));
    installFake(new FakeConnectorsRepository());
    wrap(<IntegrationsPage />);

    fireEvent.click(screen.getByRole('tab', { name: /connections|conexões/i }));
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));
    expect(screen.queryByRole('heading', { name: /New connection|Nova conexão/ })).not.toBeInTheDocument();
  });
});

describe('IntegrationsPage — webhooks', () => {
  it('exibe o token/segredo UMA vez e limpa ao fechar (nunca persiste)', async () => {
    setSessionRepository(new MockSessionRepository('many_orgs'));
    const seeded = makeActiveConnection({ id: 'conn_wh', name: 'Webhook source' });
    const fake = new FakeConnectorsRepository([seeded]);
    installFake(fake);
    wrap(<IntegrationsPage />);

    fireEvent.click(screen.getByRole('tab', { name: /webhooks/i }));
    await screen.findByLabelText(/^Key$|^Chave$/);

    fireEvent.change(screen.getByLabelText(/^Key$|^Chave$/), { target: { value: 'orders' } });
    fireEvent.change(screen.getByLabelText(/^Connection$|^Conexão$/), { target: { value: seeded.id } });
    fireEvent.change(screen.getByLabelText(/Signing secret|Segredo de assinatura/), {
      target: { value: 'provider-signing-secret' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Create endpoint|Criar endpoint/ }));

    const tokenText = await screen.findByText(/^tok_once_/);
    const token = tokenText.textContent as string;
    expect(token).toMatch(/^tok_once_/);
    expect(screen.getByText(/^sig_once_/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^Close$|^Fechar$/ }));

    await waitFor(() => expect(screen.queryByText(/^tok_once_/)).not.toBeInTheDocument());
    expect(document.body.textContent ?? '').not.toContain(token);
    expect(JSON.stringify(localStorage)).not.toContain('tok_once_');
    expect(JSON.stringify(sessionStorage)).not.toContain('tok_once_');
  });
});

describe('IntegrationsPage — vínculos de ferramenta', () => {
  it('lista vazia mostra estado vazio e respeita a permissão de leitura', async () => {
    setSessionRepository(new MockSessionRepository('many_orgs'));
    installFake(new FakeConnectorsRepository());
    wrap(<IntegrationsPage />);

    fireEvent.click(screen.getByRole('tab', { name: /tool bindings|vínculos de ferramenta/i }));
    const emptyStates = await screen.findAllByText(/Nothing here yet\.|Nada por aqui ainda\./i);
    expect(emptyStates.length).toBeGreaterThan(0);
  });
});
