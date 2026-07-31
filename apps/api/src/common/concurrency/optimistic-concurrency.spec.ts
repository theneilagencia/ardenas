import { describe, expect, it } from 'vitest';
import { assertRevision, parseIfMatch } from './optimistic-concurrency';
import { ApiException } from '../errors/api-error';

describe('optimistic concurrency', () => {
  it('parseIfMatch lê a revisão de um header', () => {
    expect(parseIfMatch('"3"')).toBe(3);
    expect(parseIfMatch('7')).toBe(7);
    expect(parseIfMatch('abc')).toBeUndefined();
    expect(parseIfMatch(undefined)).toBeUndefined();
  });

  it('assertRevision passa quando as revisões coincidem', () => {
    expect(() =>
      assertRevision({ resourceType: 'Op', resourceId: 'op_1', expectedRevision: 2, currentRevision: 2 }),
    ).not.toThrow();
  });

  it('assertRevision lança VERSION_CONFLICT quando divergem', () => {
    try {
      assertRevision({ resourceType: 'Op', resourceId: 'op_1', expectedRevision: 1, currentRevision: 3 });
      throw new Error('deveria ter lançado');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiException);
      expect((err as ApiException).code).toBe('VERSION_CONFLICT');
      expect((err as ApiException).details).toMatchObject({ expectedRevision: 1, currentRevision: 3 });
    }
  });
});
