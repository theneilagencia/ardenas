import { describe, expect, it } from 'vitest';
import { resolveCorrelationId } from './correlation-id.middleware';

describe('resolveCorrelationId', () => {
  it('preserva um id válido enviado pelo cliente', () => {
    expect(resolveCorrelationId('req-abc.123:x')).toBe('req-abc.123:x');
  });

  it('gera um UUID quando ausente', () => {
    const id = resolveCorrelationId(undefined);
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('gera um UUID quando o valor é inválido (caracteres proibidos)', () => {
    expect(resolveCorrelationId('bad value with spaces')).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('gera um UUID quando a string é grande demais (não confia)', () => {
    expect(resolveCorrelationId('x'.repeat(500))).toMatch(/^[0-9a-f-]{36}$/);
  });
});
