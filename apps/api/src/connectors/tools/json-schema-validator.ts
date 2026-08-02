/**
 * Arden.AS API — validador JSON Schema mínimo para I/O de ferramenta (ARDEN-BE-006.6).
 *
 * Valida VALORES contra os schemas serializáveis do catálogo (`jsonSchemaContract`).
 * Suporta o subconjunto usado pelos conectores de referência: type, required,
 * properties, additionalProperties (bool), enum, items. NÃO executa código, NÃO usa
 * `$ref`/`eval`/regex arbitrária — é um walk determinístico e fechado. Falha fechada.
 */

export interface SchemaViolation {
  path: string;
  message: string;
}

type JsonSchema = Record<string, unknown>;

function typeOf(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (Number.isInteger(value)) return 'integer';
  return typeof value;
}

function matchesType(value: unknown, expected: string): boolean {
  const actual = typeOf(value);
  if (expected === 'number') return actual === 'number' || actual === 'integer';
  if (expected === 'integer') return actual === 'integer';
  return actual === expected;
}

function walk(value: unknown, schema: JsonSchema, path: string, out: SchemaViolation[]): void {
  const type = schema.type as string | string[] | undefined;
  if (type !== undefined) {
    const types = Array.isArray(type) ? type : [type];
    if (!types.some((t) => matchesType(value, t))) {
      out.push({ path, message: `esperado ${types.join('|')}, recebido ${typeOf(value)}` });
      return;
    }
  }

  if (Array.isArray(schema.enum)) {
    const allowed = schema.enum as unknown[];
    if (!allowed.some((a) => a === value)) {
      out.push({ path, message: 'valor fora do enum permitido' });
    }
  }

  if (typeOf(value) === 'object' && (schema.type === 'object' || schema.properties || schema.additionalProperties !== undefined)) {
    const obj = value as Record<string, unknown>;
    const props = (schema.properties as Record<string, JsonSchema> | undefined) ?? {};
    const required = Array.isArray(schema.required) ? (schema.required as string[]) : [];
    for (const key of required) {
      if (!(key in obj)) out.push({ path: path ? `${path}.${key}` : key, message: 'campo obrigatório ausente' });
    }
    const additional = schema.additionalProperties;
    for (const [key, v] of Object.entries(obj)) {
      const childPath = path ? `${path}.${key}` : key;
      if (props[key]) {
        walk(v, props[key], childPath, out);
      } else if (additional === false) {
        out.push({ path: childPath, message: 'propriedade não permitida (additionalProperties=false)' });
      } else if (additional && typeof additional === 'object') {
        walk(v, additional as JsonSchema, childPath, out);
      }
    }
  }

  if (typeOf(value) === 'array' && schema.items && typeof schema.items === 'object') {
    (value as unknown[]).forEach((item, i) => walk(item, schema.items as JsonSchema, `${path}[${i}]`, out));
  }
}

/** Valida `value` contra `schema`. Retorna a lista de violações (vazia = válido). */
export function validateAgainstSchema(value: unknown, schema: JsonSchema | undefined): SchemaViolation[] {
  if (!schema || Object.keys(schema).length === 0) return [];
  const out: SchemaViolation[] = [];
  walk(value, schema, '', out);
  return out;
}
