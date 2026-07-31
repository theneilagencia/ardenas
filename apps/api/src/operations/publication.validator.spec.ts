/**
 * Arden.AS API — testes do validador de publicação (ARDEN-BE-003). Função pura:
 * usa objetos DB e contexto sintéticos (sem I/O).
 */

import { describe, expect, it } from 'vitest';
import type { Operation as DbOperation, OperationVersion as DbVersion } from '@prisma/client';
import type { AuthenticatedRequestContext } from '../identity/request-context';
import { OperationPublicationValidator } from './publication.validator';
import { NEUTRAL_AUTHORITY_PROFILE } from './operation.serializers';

const validator = new OperationPublicationValidator();

const ORG = 'org-1';

function ctx(permissions: string[] = ['operation.publish']): AuthenticatedRequestContext {
  return {
    correlationId: 'c1',
    userId: 'u1',
    externalSubject: 's1',
    organizationId: ORG,
    membershipId: 'm1',
    permissions: new Set(permissions),
    ipAddress: null,
    userAgent: null,
    identityExpiresAt: null,
  };
}

function operation(overrides: Partial<DbOperation> = {}): DbOperation {
  return {
    id: 'op-1',
    organizationId: ORG,
    name: 'Operação',
    description: null,
    status: 'draft',
    ownerId: null,
    currentDraftVersionId: 'v-1',
    publishedVersionId: null,
    createdBy: 'u1',
    revision: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as DbOperation;
}

function version(overrides: Partial<DbVersion> = {}): DbVersion {
  return {
    id: 'v-1',
    organizationId: ORG,
    operationId: 'op-1',
    versionNumber: 1,
    status: 'draft',
    definition: { objective: 'obj', expectedResult: 'res', triggers: [], steps: [], actions: [], approverIds: [], contextSourceIds: [], integrationIds: [], completionCriteria: [], environment: null, evidencePolicy: null },
    authorityProfile: NEUTRAL_AUTHORITY_PROFILE,
    changeSummary: null,
    createdBy: 'u1',
    publishedBy: null,
    publishedAt: null,
    revision: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as unknown as DbVersion;
}

describe('OperationPublicationValidator', () => {
  it('rascunho completo é válido', () => {
    const result = validator.validate(operation(), version(), ctx());
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('versão não rascunho é inválida', () => {
    const result = validator.validate(operation(), version({ status: 'published' }), ctx());
    expect(result.valid).toBe(false);
    expect(result.errors.map((e) => e.code)).toContain('VERSION_NOT_DRAFT');
  });

  it('objetivo vazio é inválido', () => {
    const v = version({ definition: { ...(version().definition as object), objective: '' } as DbVersion['definition'] });
    expect(validator.validate(operation(), v, ctx()).errors.map((e) => e.code)).toContain('OBJECTIVE_REQUIRED');
  });

  it('operação arquivada é inválida', () => {
    expect(
      validator.validate(operation({ status: 'archived' }), version(), ctx()).errors.map((e) => e.code),
    ).toContain('OPERATION_ARCHIVED');
  });

  it('sem permissão operation.publish é inválido', () => {
    expect(validator.validate(operation(), version(), ctx([])).errors.map((e) => e.code)).toContain('PERMISSION_DENIED');
  });

  it('tenant divergente é inválido', () => {
    expect(
      validator.validate(operation({ organizationId: 'outro' }), version(), ctx()).errors.map((e) => e.code),
    ).toContain('TENANT_MISMATCH');
  });
});
