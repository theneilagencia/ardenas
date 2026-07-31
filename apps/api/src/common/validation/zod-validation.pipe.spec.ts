import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ZodValidationPipe } from './zod-validation.pipe';
import { ApiException } from '../errors/api-error';

const schema = z.object({ name: z.string().min(1) }).strict();

describe('ZodValidationPipe', () => {
  it('aceita e retorna entrada válida', () => {
    const pipe = new ZodValidationPipe(schema);
    expect(pipe.transform({ name: 'ok' })).toEqual({ name: 'ok' });
  });

  it('rejeita entrada inválida com VALIDATION_ERROR + fieldErrors', () => {
    const pipe = new ZodValidationPipe(schema);
    try {
      pipe.transform({ name: '' });
      throw new Error('deveria ter lançado');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiException);
      expect((err as ApiException).code).toBe('VALIDATION_ERROR');
      expect((err as ApiException).fieldErrors?.[0].field).toBe('name');
    }
  });

  it('rejeita campos desconhecidos (schema strict)', () => {
    const pipe = new ZodValidationPipe(schema);
    expect(() => pipe.transform({ name: 'x', extra: 1 })).toThrow(ApiException);
  });
});
