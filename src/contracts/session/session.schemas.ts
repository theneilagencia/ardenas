/**
 * Arden.AS — API v1 · sessão (schemas) (ARDEN-FE-003).
 *
 * Espelha o `SessionContext` do frontend (ARDEN-FE-002), agora como contrato
 * compartilhado. O servidor é a fonte de verdade: usuário, organizações,
 * memberships, organização ativa e permissões efetivas são RESOLVIDOS pelo backend.
 * O cliente nunca envia permissões nem escolhe o tenant arbitrariamente.
 */

import { z } from 'zod';
import { isoUtcDateTime } from '../common/timestamps';
import { membershipId, organizationId, userId } from '../common/identifiers';

export const userStatus = z.enum(['active', 'suspended']);
export type UserStatus = z.infer<typeof userStatus>;

export const authenticatedUser = z.object({
  id: userId,
  email: z.string().email(),
  displayName: z.string().min(1),
  avatarUrl: z.string().url().nullable().optional(),
  status: userStatus,
});
export type AuthenticatedUser = z.infer<typeof authenticatedUser>;

export const organizationStatus = z.enum(['active', 'suspended']);
export type OrganizationStatus = z.infer<typeof organizationStatus>;

export const organizationSummary = z.object({
  id: organizationId,
  name: z.string().min(1),
  slug: z.string().min(1),
  status: organizationStatus,
});
export type OrganizationSummary = z.infer<typeof organizationSummary>;

export const membershipStatus = z.enum(['active', 'invited', 'suspended']);
export type MembershipStatus = z.infer<typeof membershipStatus>;

export const membership = z.object({
  id: membershipId,
  userId,
  organizationId,
  roleIds: z.array(z.string().min(1)),
  status: membershipStatus,
});
export type Membership = z.infer<typeof membership>;

export const sessionStatus = z.enum([
  'authenticated',
  'expired',
  'suspended',
  'no_organization',
]);
export type SessionStatus = z.infer<typeof sessionStatus>;

export const sessionContext = z.object({
  user: authenticatedUser,
  organizations: z.array(organizationSummary),
  memberships: z.array(membership),
  activeOrganizationId: organizationId.nullable(),
  /** Permissões EFETIVAS no tenant ativo — resolvidas pelo servidor. */
  permissions: z.array(z.string()),
  expiresAt: isoUtcDateTime.nullable(),
  status: sessionStatus,
});
export type SessionContext = z.infer<typeof sessionContext>;

// ── Requests ──────────────────────────────────────────────────────────────────

export const switchOrganizationRequest = z.object({
  organizationId,
});
export type SwitchOrganizationRequest = z.infer<typeof switchOrganizationRequest>;
