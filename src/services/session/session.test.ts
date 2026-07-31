import { describe, expect, it } from 'vitest';
import { MemorySnapshotStore } from '../data/snapshot-store';
import { MemorySessionSelectionStore } from './session-selection-store';
import { SnapshotSessionRepository } from './snapshot-session-repository';
import { MockSessionRepository, buildScenarioSession } from './mock-session-repository';
import { ApiSessionRepository } from './api-session-repository';
import { ApiClient } from '../api-client';
import { deriveSessionStatus } from '@/domain/identity';
import { buildSeed } from '@/domain/seed';

function snapshotRepo() {
  return new SnapshotSessionRepository(
    new MemorySnapshotStore(buildSeed()),
    new MemorySessionSelectionStore(),
    () => ({ kind: 'none' }),
  );
}

describe('SnapshotSessionRepository (mock/indexeddb)', () => {
  it('carrega sessão autenticada com organização ativa', async () => {
    const session = await snapshotRepo().getCurrentSession();
    expect(session).not.toBeNull();
    expect(session!.activeOrganizationId).toBe('org_arden');
    expect(session!.user.email).toBe('helena@arden.as');
    expect(deriveSessionStatus({ session, loading: false, error: null })).toBe('authenticated');
  });

  it('usuário com várias organizações (memberships por e-mail)', async () => {
    const session = await snapshotRepo().getCurrentSession();
    const orgs = session!.memberships.map((m) => m.organizationId).sort();
    expect(orgs).toEqual(['org_arden', 'org_horizon']);
  });

  it('troca de organização válida atualiza o tenant ativo', async () => {
    const repo = snapshotRepo();
    await repo.getCurrentSession();
    const next = await repo.switchOrganization('org_horizon');
    expect(next.activeOrganizationId).toBe('org_horizon');
  });

  it('trocar para organização sem membership lança FORBIDDEN', async () => {
    const repo = snapshotRepo();
    await repo.getCurrentSession();
    await expect(repo.switchOrganization('org_inexistente')).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('sign-out remove a sessão', async () => {
    const repo = snapshotRepo();
    await repo.getCurrentSession();
    await repo.signOut();
    expect(await repo.getCurrentSession()).toBeNull();
  });

  it('simulação "expired" deriva estado de sessão expirada', async () => {
    const repo = new SnapshotSessionRepository(
      new MemorySnapshotStore(buildSeed()),
      new MemorySessionSelectionStore(),
      () => ({ kind: 'expired' }),
    );
    const session = await repo.getCurrentSession();
    expect(deriveSessionStatus({ session, loading: false, error: null })).toBe('expired');
  });
});

describe('MockSessionRepository — cenários exigidos', () => {
  it('uma organização', () => {
    const s = buildScenarioSession('one_org')!;
    expect(s.memberships).toHaveLength(1);
    expect(deriveSessionStatus({ session: s, loading: false, error: null })).toBe('authenticated');
  });

  it('sem organização', () => {
    const s = buildScenarioSession('no_org')!;
    expect(deriveSessionStatus({ session: s, loading: false, error: null })).toBe('no_organization');
  });

  it('usuário suspenso', () => {
    const s = buildScenarioSession('suspended_user')!;
    expect(deriveSessionStatus({ session: s, loading: false, error: null })).toBe('suspended');
  });

  it('membership suspensa', () => {
    const s = buildScenarioSession('suspended_membership')!;
    expect(deriveSessionStatus({ session: s, loading: false, error: null })).toBe('suspended');
  });

  it('sessão expirada', () => {
    const s = buildScenarioSession('expired')!;
    expect(deriveSessionStatus({ session: s, loading: false, error: null })).toBe('expired');
  });

  it('permissão insuficiente: sem operation.publish', () => {
    const s = buildScenarioSession('insufficient_permission')!;
    expect(s.permissions).not.toContain('operation.publish');
  });

  it('troca inválida rejeita e mantém a sessão', async () => {
    const repo = new MockSessionRepository('many_orgs');
    await expect(repo.switchOrganization('org_x')).rejects.toMatchObject({ code: 'FORBIDDEN' });
    const s = await repo.getCurrentSession();
    expect(s!.activeOrganizationId).toBe('org_a');
  });
});

describe('ApiSessionRepository — sem fallback silencioso', () => {
  it('erro tipado quando a API não está configurada (sem base URL)', async () => {
    const repo = new ApiSessionRepository(new ApiClient({ baseUrl: '' }), '');
    await expect(repo.getCurrentSession()).rejects.toMatchObject({ code: 'UNAVAILABLE' });
    await expect(repo.switchOrganization('org_a')).rejects.toMatchObject({ code: 'UNAVAILABLE' });
  });
});
