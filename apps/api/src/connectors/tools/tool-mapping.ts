/**
 * Arden.AS API — mapeamento declarativo de I/O de ferramenta (ARDEN-BE-006.6).
 *
 * DSL FECHADA e SEGURA (dados, nunca código). Um mapa é um objeto cujas chaves são os
 * campos de destino e cujos valores são NÓS. Cada nó é EXATAMENTE um de:
 *   { "path": "input.a.b" }      → seleciona por caminho pontilhado
 *   { "rename": "input.a" }      → idem `path` (o "rename" é a chave-alvo diferente)
 *   { "const": <literal> }       → constante NÃO sensível (dado do autor, nunca segredo)
 *   { "compose": { k: <nó>, … } }→ objeto aninhado recursivo
 *
 * Raízes permitidas: apenas `input` e `steps` (entrada) ou `output` (saída). NÃO há
 * `env`, `vault`, acesso a outro tenant, wildcards, loops, funções, templates, `eval`,
 * `$ref` ou `..`. Mapa vazio ⇒ identidade (passa a origem adiante). Falha ⇒ erro tipado.
 */

export class ToolMappingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ToolMappingError';
  }
}

const SEGMENT = /^[A-Za-z0-9_-]+$/;

/** Navega um caminho pontilhado seguro. Retorna `undefined` se algum passo faltar. */
function selectPath(source: Record<string, unknown>, rawPath: string, allowedRoots: string[]): unknown {
  const segments = rawPath.split('.');
  if (segments.length === 0) throw new ToolMappingError('Caminho vazio.');
  for (const seg of segments) {
    if (!SEGMENT.test(seg)) throw new ToolMappingError(`Segmento de caminho inválido: "${seg}".`);
  }
  if (!allowedRoots.includes(segments[0])) {
    throw new ToolMappingError(`Raiz de caminho não permitida: "${segments[0]}".`);
  }
  let current: unknown = source;
  for (const seg of segments) {
    if (current === null || current === undefined || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[seg];
  }
  return current;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Constante segura: primitivos, arrays e objetos de primitivos. Sem funções. */
function assertSafeConst(value: unknown, depth = 0): void {
  if (depth > 8) throw new ToolMappingError('Constante aninhada demais.');
  if (value === null) return;
  const t = typeof value;
  if (t === 'string' || t === 'number' || t === 'boolean') return;
  if (Array.isArray(value)) {
    value.forEach((v) => assertSafeConst(v, depth + 1));
    return;
  }
  if (isPlainObject(value)) {
    Object.values(value).forEach((v) => assertSafeConst(v, depth + 1));
    return;
  }
  throw new ToolMappingError('Constante contém valor não serializável.');
}

function evalNode(node: unknown, source: Record<string, unknown>, allowedRoots: string[], depth: number): unknown {
  if (depth > 16) throw new ToolMappingError('Mapa aninhado demais.');
  if (!isPlainObject(node)) {
    throw new ToolMappingError('Nó de mapeamento deve ser um objeto com exatamente uma operação.');
  }
  const keys = Object.keys(node);
  if (keys.length !== 1) {
    throw new ToolMappingError(`Nó deve ter exatamente uma operação; recebeu [${keys.join(', ')}].`);
  }
  const [op] = keys;
  const arg = node[op];
  switch (op) {
    case 'path':
    case 'rename': {
      if (typeof arg !== 'string') throw new ToolMappingError(`"${op}" exige uma string de caminho.`);
      return selectPath(source, arg, allowedRoots);
    }
    case 'const': {
      assertSafeConst(arg);
      return arg;
    }
    case 'compose': {
      if (!isPlainObject(arg)) throw new ToolMappingError('"compose" exige um objeto.');
      const out: Record<string, unknown> = {};
      for (const [k, child] of Object.entries(arg)) {
        if (!SEGMENT.test(k)) throw new ToolMappingError(`Chave de compose inválida: "${k}".`);
        const v = evalNode(child, source, allowedRoots, depth + 1);
        if (v !== undefined) out[k] = v;
      }
      return out;
    }
    default:
      throw new ToolMappingError(`Operação de mapeamento desconhecida: "${op}".`);
  }
}

/**
 * Aplica um mapa declarativo. `map` vazio ⇒ identidade (retorna `source[identityKey]`).
 * `allowedRoots` restringe as raízes acessíveis (ex.: ['input','steps'] ou ['output']).
 */
export function applyMapping(
  map: unknown,
  source: Record<string, unknown>,
  allowedRoots: string[],
  identityKey: string,
): unknown {
  if (map === null || map === undefined || (isPlainObject(map) && Object.keys(map).length === 0)) {
    return source[identityKey];
  }
  if (!isPlainObject(map)) throw new ToolMappingError('Mapa de nível superior deve ser um objeto.');
  const out: Record<string, unknown> = {};
  for (const [target, node] of Object.entries(map)) {
    if (!SEGMENT.test(target)) throw new ToolMappingError(`Chave de destino inválida: "${target}".`);
    const value = evalNode(node, source, allowedRoots, 0);
    if (value !== undefined) out[target] = value;
  }
  return out;
}
