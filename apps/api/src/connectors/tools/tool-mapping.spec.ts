/**
 * Arden.AS API — testes do mapeamento declarativo (ARDEN-BE-006.6).
 */

import { describe, expect, it } from 'vitest';
import { applyMapping, ToolMappingError } from './tool-mapping';

const source = { input: { user: { id: '42', name: 'Ana' }, count: 3 }, steps: { s1: { output: { token: 'x' } } } };

describe('applyMapping — entrada', () => {
  it('mapa vazio ⇒ identidade (retorna input)', () => {
    expect(applyMapping({}, source, ['input', 'steps'], 'input')).toEqual(source.input);
  });

  it('path seleciona por caminho pontilhado', () => {
    expect(applyMapping({ userId: { path: 'input.user.id' } }, source, ['input', 'steps'], 'input')).toEqual({ userId: '42' });
  });

  it('rename mapeia para chave-alvo diferente', () => {
    expect(applyMapping({ nome: { rename: 'input.user.name' } }, source, ['input', 'steps'], 'input')).toEqual({ nome: 'Ana' });
  });

  it('const injeta literal não sensível', () => {
    expect(applyMapping({ kind: { const: 'order' } }, source, ['input', 'steps'], 'input')).toEqual({ kind: 'order' });
  });

  it('compose monta objeto aninhado', () => {
    const map = { body: { compose: { id: { path: 'input.user.id' }, kind: { const: 'user' } } } };
    expect(applyMapping(map, source, ['input', 'steps'], 'input')).toEqual({ body: { id: '42', kind: 'user' } });
  });

  it('acessa output de etapa anterior', () => {
    expect(applyMapping({ t: { path: 'steps.s1.output.token' } }, source, ['input', 'steps'], 'input')).toEqual({ t: 'x' });
  });

  it('caminho ausente ⇒ chave omitida', () => {
    expect(applyMapping({ x: { path: 'input.missing.deep' } }, source, ['input', 'steps'], 'input')).toEqual({});
  });
});

describe('applyMapping — segurança', () => {
  it('rejeita raiz não permitida (env)', () => {
    expect(() => applyMapping({ x: { path: 'env.SECRET' } }, source, ['input', 'steps'], 'input')).toThrow(ToolMappingError);
  });

  it('rejeita raiz não permitida (vault)', () => {
    expect(() => applyMapping({ x: { path: 'vault.key' } }, source, ['input', 'steps'], 'input')).toThrow(ToolMappingError);
  });

  it('rejeita segmento inválido (traversal)', () => {
    expect(() => applyMapping({ x: { path: 'input..user' } }, source, ['input', 'steps'], 'input')).toThrow(ToolMappingError);
  });

  it('rejeita nó com múltiplas operações', () => {
    expect(() => applyMapping({ x: { path: 'input.count', const: 1 } }, source, ['input', 'steps'], 'input')).toThrow(ToolMappingError);
  });

  it('rejeita operação desconhecida', () => {
    expect(() => applyMapping({ x: { eval: 'code' } }, source, ['input', 'steps'], 'input')).toThrow(ToolMappingError);
  });
});

describe('applyMapping — saída', () => {
  const out = { output: { status: 200, body: { ok: true } } };
  it('extrai do output', () => {
    expect(applyMapping({ ok: { path: 'output.body.ok' } }, out, ['output'], 'output')).toEqual({ ok: true });
  });
  it('não permite raiz input no mapa de saída', () => {
    expect(() => applyMapping({ x: { path: 'input.a' } }, out, ['output'], 'output')).toThrow(ToolMappingError);
  });
});
