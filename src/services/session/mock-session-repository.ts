/**
 * Arden.AS — SessionRepository de mock configurável (ARDEN-FE-002).
 *
 * Totalmente sintético: usado por testes para exercitar os cenários exigidos —
 * usuário com uma organização, com várias, sem organização, usuário suspenso,
 * membership suspensa, sessão expirada e permissão insuficiente. Valida a
 * membership ativa na troca de organização, como o provedor real.
 */

import type {
  AuthenticatedUser,
  Membership,
  OrganizationSummary,
  SessionContext,
} from '@/domain/identity';
import { permissionResolver } from '@/domain/permission-resolver';
import type { Permission } from '@/domain/permissions';
import type { RoleKey } from '@/domain/types';
import { ArdenRepositoryError } from '../errors';
import type { SessionRepository } from './session-contracts';

export type SessionScenario =
  | 'one_org'
  | 'many_orgs'
  | 'no_org'
  | 'suspended_user'
  | 'suspended_membership'
  | 'expired'
  | 'insufficient_permission';

const USER: AuthenticatedUser = {
  id: 'user_demo',
  email: 'demo@arden.as',
  displayName: 'Usuária Demo',
  status: 'active',
};

function org(id: string, name: string): OrganizationSummary {
  return { id, name, slug: id, status: 'active' };
}

function membership(
  organizationId: string,
  roleIds: RoleKey[],
  status: Membership['status'] = 'active',
): Membership {
  return { id: `mb_${organizationId}`, userId: USER.id, organizationId, roleIds, status };
}

const HOUR = 60 * 60 * 1000;

/** Constrói uma sessão sintética para o cenário pedido (null = não autenticada). */
export function buildScenarioSession(scenario: SessionScenario): SessionContext | null {
  const orgA = org('org_a', 'Organização A');
  const orgB = org('org_b', 'Organização B');
  const future = new Date(Date.now() + 8 * HOUR).toISOString();

  switch (scenario) {
    case 'one_org': {
      const m = membership('org_a', ['operation_owner']);
      return {
        user: USER,
        organizations: [orgA],
        memberships: [m],
        activeOrganizationId: 'org_a',
        permissions: permissionResolver.forMembership(m),
        expiresAt: future,
      };
    }
    case 'many_orgs': {
      const mA = membership('org_a', ['corporate_admin']);
      const mB = membership('org_b', ['operation_owner']);
      return {
        user: USER,
        organizations: [orgA, orgB],
        memberships: [mA, mB],
        activeOrganizationId: 'org_a',
        permissions: permissionResolver.forMembership(mA),
        expiresAt: future,
      };
    }
    case 'no_org':
      return {
        user: USER,
        organizations: [],
        memberships: [],
        activeOrganizationId: null,
        permissions: [],
        expiresAt: future,
      };
    case 'suspended_user':
      return {
        user: { ...USER, status: 'suspended' },
        organizations: [orgA],
        memberships: [membership('org_a', ['operation_owner'])],
        activeOrganizationId: 'org_a',
        permissions: [],
        expiresAt: future,
      };
    case 'suspended_membership': {
      const m = membership('org_a', ['operation_owner'], 'suspended');
      return {
        user: USER,
        organizations: [orgA],
        memberships: [m],
        activeOrganizationId: 'org_a',
        permissions: [],
        expiresAt: future,
      };
    }
    case 'expired': {
      const m = membership('org_a', ['operation_owner']);
      return {
        user: USER,
        organizations: [orgA],
        memberships: [m],
        activeOrganizationId: 'org_a',
        permissions: permissionResolver.forMembership(m),
        expiresAt: new Date(Date.now() - HOUR).toISOString(),
      };
    }
    case 'insufficient_permission': {
      const m = membership('org_a', ['analyst']);
      // Analista não possui operation.create/publish.
      const permissions = permissionResolver.forMembership(m).filter(
        (p): p is Permission => p !== 'operation.create' && p !== 'operation.publish',
      );
      return {
        user: USER,
        organizations: [orgA],
        memberships: [m],
        activeOrganizationId: 'org_a',
        permissions,
        expiresAt: future,
      };
    }
  }
}

export class MockSessionRepository implements SessionRepository {
  private session: SessionContext | null;

  constructor(init: SessionScenario | SessionContext | null = 'many_orgs') {
    this.session =
      typeof init === 'string' ? buildScenarioSession(init) : init;
  }

  async getCurrentSession(): Promise<SessionContext | null> {
    return this.session ? structuredClone(this.session) : null;
  }

  async switchOrganization(organizationId: string): Promise<SessionContext> {
    if (!this.session) throw new ArdenRepositoryError('UNAUTHORIZED', 'Sessão ausente.');
    const m = this.session.memberships.find((x) => x.organizationId === organizationId);
    if (!m || m.status !== 'active') {
      throw new ArdenRepositoryError('FORBIDDEN', 'Sem membership ativa na organização.');
    }
    this.session = {
      ...this.session,
      activeOrganizationId: organizationId,
      permissions: permissionResolver.forMembership(m),
    };
    return structuredClone(this.session);
  }

  async refreshSession(): Promise<SessionContext> {
    if (!this.session) throw new ArdenRepositoryError('UNAUTHORIZED', 'Sessão ausente.');
    const future = new Date(Date.now() + 8 * HOUR).toISOString();
    this.session = { ...this.session, expiresAt: future };
    return structuredClone(this.session);
  }

  async signOut(): Promise<void> {
    this.session = null;
  }
}
