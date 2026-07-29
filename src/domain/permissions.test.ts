import { describe, expect, it } from 'vitest';
import { can, permissionsFor, type Session } from './permissions';
import type { Operation, Person, RoleKey } from './types';

function makeSession(role: RoleKey, overrides: Partial<Person> = {}): Session {
  const person: Person = {
    id: `p_${role}`,
    organizationId: 'org_arden',
    companyId: 'co_arden_br',
    name: role,
    email: `${role}@arden.as`,
    roleKeys: [role],
    status: 'active',
    ...overrides,
  };
  return {
    person,
    organizationId: 'org_arden',
    roleKeys: person.roleKeys,
    permissions: permissionsFor(person.roleKeys),
  };
}

const baseOp = {
  organizationId: 'org_arden',
  companyId: 'co_arden_br',
} as Operation;

describe('cenários de bloqueio obrigatórios', () => {
  it('1. Auditor não edita nenhum campo', () => {
    const r = can({ action: 'operation.edit', session: makeSession('auditor'), subject: baseOp });
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe('missing_permission');
  });

  it('2. Analista não aprova ação crítica', () => {
    expect(can({ action: 'approval.resolve', session: makeSession('analyst') }).allowed).toBe(false);
  });

  it('3. Aprovador não altera configuração da operação', () => {
    expect(can({ action: 'operation.edit', session: makeSession('approver') }).allowed).toBe(false);
  });

  it('4. Supervisor não altera papel de usuário', () => {
    expect(can({ action: 'role.manage', session: makeSession('supervisor') }).allowed).toBe(false);
  });

  it('5. Administrador financeiro não publica política', () => {
    expect(can({ action: 'policy.publish', session: makeSession('financial_admin') }).allowed).toBe(
      false,
    );
  });

  it('6. Administrador de segurança não altera orçamento', () => {
    expect(can({ action: 'budget.manage', session: makeSession('security_admin') }).allowed).toBe(
      false,
    );
  });

  it('7. Proprietário não administra operação de outra empresa', () => {
    const otherCompanyOp = { ...baseOp, companyId: 'co_outra' } as Operation;
    const r = can({
      action: 'operation.edit',
      session: makeSession('operation_owner'),
      subject: otherCompanyOp,
    });
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe('cross_company');
  });

  it('8. Usuário suspenso não acessa nenhuma rota', () => {
    const r = can({
      action: 'operation.view',
      session: makeSession('analyst', { status: 'suspended' }),
    });
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe('suspended');
  });

  it('9. Usuário sem permissão não exporta dado restrito', () => {
    expect(can({ action: 'report.export', session: makeSession('supervisor') }).allowed).toBe(false);
  });
});

describe('escopo por organização', () => {
  it('nega quando o subject é de outra organização', () => {
    const r = can({
      action: 'operation.view',
      session: makeSession('corporate_admin'),
      subject: { organizationId: 'org_outra' } as Operation,
    });
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe('cross_organization');
  });

  it('administrador corporativo pode tudo na própria organização', () => {
    expect(
      can({ action: 'operation.publish', session: makeSession('corporate_admin'), subject: baseOp })
        .allowed,
    ).toBe(true);
  });
});
