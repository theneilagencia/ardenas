/**
 * Arden.AS API — testes do validador JSON Schema mínimo (ARDEN-BE-006.6).
 */

import { describe, expect, it } from 'vitest';
import { validateAgainstSchema } from './json-schema-validator';

const inputSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['method'],
  properties: {
    method: { type: 'string', enum: ['GET', 'POST'] },
    path: { type: 'string' },
    count: { type: 'integer' },
  },
};

describe('validateAgainstSchema — input', () => {
  it('válido', () => {
    expect(validateAgainstSchema({ method: 'GET', path: '/x' }, inputSchema)).toEqual([]);
  });
  it('campo obrigatório ausente', () => {
    const v = validateAgainstSchema({ path: '/x' }, inputSchema);
    expect(v.some((e) => e.message.includes('obrigatório'))).toBe(true);
  });
  it('enum inválido', () => {
    const v = validateAgainstSchema({ method: 'DELETE' }, inputSchema);
    expect(v.some((e) => e.message.includes('enum'))).toBe(true);
  });
  it('propriedade não permitida (additionalProperties=false)', () => {
    const v = validateAgainstSchema({ method: 'GET', extra: 1 }, inputSchema);
    expect(v.some((e) => e.path === 'extra')).toBe(true);
  });
  it('tipo errado', () => {
    const v = validateAgainstSchema({ method: 'GET', count: 'x' }, inputSchema);
    expect(v.some((e) => e.path === 'count')).toBe(true);
  });
  it('schema vazio ⇒ sem violações', () => {
    expect(validateAgainstSchema({ any: true }, {})).toEqual([]);
  });
});

describe('validateAgainstSchema — output', () => {
  const outputSchema = { type: 'object', additionalProperties: false, properties: { status: { type: 'integer' }, body: {} } };
  it('output válido', () => {
    expect(validateAgainstSchema({ status: 200, body: { ok: true } }, outputSchema)).toEqual([]);
  });
  it('output com propriedade extra falha', () => {
    expect(validateAgainstSchema({ status: 200, secretHeader: 'x' }, outputSchema).length).toBeGreaterThan(0);
  });
});
