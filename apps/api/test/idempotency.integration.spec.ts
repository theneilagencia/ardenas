/**
 * Arden.AS API — idempotência sobre PostgreSQL real (ARDEN-BE-001).
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { IdempotencyService, hashRequestBody } from '../src/modules/idempotency/idempotency.service';
import type { PrismaService } from '../src/database/prisma.service';

const prisma = new PrismaClient();
const service = new IdempotencyService(prisma as unknown as PrismaService);
const parts = { method: 'POST', path: '/api/v1/organizations/o/operations', idempotencyKey: 'itest-key' };

beforeAll(async () => {
  await prisma.$connect();
});

afterAll(async () => {
  await prisma.idempotencyRecord.deleteMany({ where: { idempotencyKey: parts.idempotencyKey } });
  await prisma.$disconnect();
});

beforeEach(async () => {
  await prisma.idempotencyRecord.deleteMany({ where: { idempotencyKey: parts.idempotencyKey } });
});

describe('IdempotencyService (PostgreSQL)', () => {
  it('detecta chave nova, depois replay, depois conflito', async () => {
    const hash = hashRequestBody({ name: 'A' });

    // Nova chave.
    expect(await service.check(parts, hash)).toEqual({ outcome: 'new' });

    // Persiste a resposta produzida.
    await service.remember({
      ...parts,
      organizationId: 'org_1',
      userId: 'user_1',
      requestHash: hash,
      statusCode: 201,
      response: { id: 'op_1' },
    });

    // Mesma chave + mesmo body → replay da mesma resposta.
    expect(await service.check(parts, hash)).toEqual({
      outcome: 'replay',
      statusCode: 201,
      response: { id: 'op_1' },
    });

    // Mesma chave + body diferente → conflito.
    const otherHash = hashRequestBody({ name: 'B' });
    expect(await service.check(parts, otherHash)).toEqual({ outcome: 'conflict' });
  });

  it('purga registros expirados', async () => {
    const hash = hashRequestBody({ x: 1 });
    await service.remember({ ...parts, requestHash: hash, statusCode: 200, response: {}, ttlMs: -1000 });
    const purged = await service.purgeExpired();
    expect(purged).toBeGreaterThanOrEqual(1);
  });
});
