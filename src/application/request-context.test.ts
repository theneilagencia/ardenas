import { describe, expect, it } from 'vitest';
import { assertPermission, toRequestContext, type RequestContext } from './request-context';
import { permissionResolver } from '@/domain/permission-resolver';
import { buildScenarioSession } from '@/services/session/mock-session-repository';
import { ArdenRepositoryError } from '@/services/errors';

const base: RequestContext = {
  userId: 'u1',
  organizationId: 'org_a',
  correlationId: 'req_1',
  actorRole: 'operation_owner',
  permissions: ['operation.view', 'operation.create'],
};

describe('assertPermission (defesa local de UX)', () => {
  it('não lança quando a permissão está presente', () => {
    expect(() => assertPermission(base, 'operation.create')).not.toThrow();
  });

  it('lança FORBIDDEN quando a permissão está ausente', () => {
    expect(() => assertPermission(base, 'operation.publish')).toThrow(ArdenRepositoryError);
    try {
      assertPermission(base, 'operation.publish');
    } catch (err) {
      expect((err as ArdenRepositoryError).code).toBe('FORBIDDEN');
    }
  });
});

describe('toRequestContext (tenant derivado da sessão)', () => {
  it('deriva organizationId da organização ativa da sessão', () => {
    const session = buildScenarioSession('many_orgs')!;
    const ctx = toRequestContext(session);
    expect(ctx?.organizationId).toBe(session.activeOrganizationId);
    expect(ctx?.userId).toBe(session.user.id);
  });

  it('retorna null sem organização ativa', () => {
    const session = buildScenarioSession('no_org')!;
    expect(toRequestContext(session)).toBeNull();
  });
});

describe('permissionResolver (identificadores estáveis)', () => {
  it('can() confere presença de permissão', () => {
    expect(permissionResolver.can(['operation.publish'], 'operation.publish')).toBe(true);
    expect(permissionResolver.can(['operation.view'], 'operation.publish')).toBe(false);
  });

  it('membership suspensa não recebe permissões', () => {
    const perms = permissionResolver.forMembership({
      id: 'm',
      userId: 'u',
      organizationId: 'o',
      roleIds: ['corporate_admin'],
      status: 'suspended',
    });
    expect(perms).toHaveLength(0);
  });
});
