/**
 * Arden.AS — derivação da sessão a partir do domínio (ARDEN-FE-002).
 *
 * Funções puras que traduzem o snapshot (pessoas/organizações) + a seleção local
 * em um `SessionContext`. Um "usuário" é identificado pelo e-mail: o mesmo humano
 * pode ter registros de pessoa em várias organizações — cada registro vira uma
 * `Membership`. Isto é uma SIMULAÇÃO local; o backend será a autoridade.
 */

import type {
  AuthenticatedUser,
  Membership,
  OrganizationSummary,
  SessionContext,
} from '@/domain/identity';
import { permissionResolver } from '@/domain/permission-resolver';
import type { DomainSnapshot } from '../contracts';
import type { Organization, Person } from '@/domain/types';

export function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/** Identidade estável do usuário a partir do e-mail. */
export function stableUserId(email: string): string {
  return `user_${slugify(email.split('@')[0] ?? email)}`;
}

function membershipStatus(person: Person): Membership['status'] {
  if (person.status === 'suspended') return 'suspended';
  if (person.status === 'invited') return 'invited';
  return 'active';
}

/** Memberships de um usuário (todos os registros de pessoa com o mesmo e-mail). */
export function deriveMemberships(people: Person[], email: string, userId: string): Membership[] {
  return people
    .filter((p) => p.email === email)
    .map((p) => ({
      id: p.id,
      userId,
      organizationId: p.organizationId,
      roleIds: p.roleKeys,
      status: membershipStatus(p),
    }));
}

export function toOrganizationSummary(org: Organization): OrganizationSummary {
  return { id: org.id, name: org.name, slug: slugify(org.name || org.id), status: 'active' };
}

/** Pessoa "padrão" (fallback) quando não há seleção: o administrador corporativo. */
export function defaultPerson(people: Person[]): Person | null {
  return (
    people.find((p) => p.roleKeys.includes('corporate_admin') && p.status === 'active') ??
    people.find((p) => p.status === 'active') ??
    people[0] ??
    null
  );
}

export interface BuildSessionInput {
  snapshot: DomainSnapshot;
  currentUserId: string | null;
  activeOrganizationId: string | null;
  expiresAt: string | null;
  /** Força o papel efetivo da membership ativa (simulação de demonstração). */
  forceRole?: string;
}

/**
 * Constrói o `SessionContext` completo. Retorna `null` quando não há usuário
 * resolvível (equivale a não autenticado).
 */
export function buildSessionContext(input: BuildSessionInput): SessionContext | null {
  const { snapshot, currentUserId, activeOrganizationId, expiresAt, forceRole } = input;

  // Resolve a pessoa "âncora" (por userId derivado do e-mail) ou o padrão.
  const anchor =
    (currentUserId
      ? snapshot.people.find((p) => stableUserId(p.email) === currentUserId)
      : null) ?? defaultPerson(snapshot.people);
  if (!anchor) return null;

  const userId = stableUserId(anchor.email);
  const memberships = deriveMemberships(snapshot.people, anchor.email, userId);

  const user: AuthenticatedUser = {
    id: userId,
    email: anchor.email,
    displayName: anchor.name,
    status: anchor.status === 'suspended' ? 'suspended' : 'active',
  };

  const organizations = memberships
    .map((m) => snapshot.organizations.find((o) => o.id === m.organizationId))
    .filter((o): o is Organization => Boolean(o))
    .map(toOrganizationSummary);

  const activeMemberships = memberships.filter((m) => m.status === 'active');
  const resolvedActiveOrg =
    activeOrganizationId && activeMemberships.some((m) => m.organizationId === activeOrganizationId)
      ? activeOrganizationId
      : (activeMemberships[0]?.organizationId ?? null);

  const active = memberships.find((m) => m.organizationId === resolvedActiveOrg) ?? null;
  const effective =
    active && forceRole
      ? { ...active, roleIds: [forceRole as Membership['roleIds'][number]] }
      : active;
  const permissions = permissionResolver.forMembership(effective);

  return {
    user,
    organizations,
    memberships,
    activeOrganizationId: resolvedActiveOrg,
    permissions,
    expiresAt,
  };
}
