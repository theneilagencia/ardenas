import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IdempotencyService, hashRequestBody } from './idempotency.service';
import type { PrismaService } from '../../database/prisma.service';

function makePrisma(findUniqueResult: unknown) {
  return {
    idempotencyRecord: {
      findUnique: vi.fn().mockResolvedValue(findUniqueResult),
      create: vi.fn().mockResolvedValue({}),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
  } as unknown as PrismaService;
}

const parts = { method: 'POST', path: '/api/v1/organizations/o/operations', idempotencyKey: 'key-123' };

describe('hashRequestBody', () => {
  it('é determinístico para o mesmo corpo e difere para corpos diferentes', () => {
    expect(hashRequestBody({ a: 1 })).toBe(hashRequestBody({ a: 1 }));
    expect(hashRequestBody({ a: 1 })).not.toBe(hashRequestBody({ a: 2 }));
  });
});

describe('IdempotencyService.check', () => {
  let hash: string;
  beforeEach(() => {
    hash = hashRequestBody({ name: 'X' });
  });

  it('retorna "new" quando não há registro', async () => {
    const svc = new IdempotencyService(makePrisma(null));
    expect(await svc.check(parts, hash)).toEqual({ outcome: 'new' });
  });

  it('retorna "replay" quando a chave existe com o MESMO hash', async () => {
    const svc = new IdempotencyService(
      makePrisma({ requestHash: hash, statusCode: 201, response: { id: 'op_1' } }),
    );
    expect(await svc.check(parts, hash)).toEqual({
      outcome: 'replay',
      statusCode: 201,
      response: { id: 'op_1' },
    });
  });

  it('retorna "conflict" quando a chave existe com hash DIFERENTE', async () => {
    const svc = new IdempotencyService(
      makePrisma({ requestHash: 'outro-hash', statusCode: 201, response: {} }),
    );
    expect(await svc.check(parts, hash)).toEqual({ outcome: 'conflict' });
  });
});
