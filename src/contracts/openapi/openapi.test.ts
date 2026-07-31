/**
 * Arden.AS — testes do OpenAPI v1 (ARDEN-FE-003).
 * O documento é válido estruturalmente e o arquivo comitado está em sincronia com
 * a fonte (src/contracts). Se falhar por sincronia: `npm run contracts:openapi`.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import * as yaml from 'js-yaml';
import { buildOpenApiDocument } from './build-openapi';
import { validateOpenApiDocument } from './validate-openapi';

describe('OpenAPI v1', () => {
  it('documento é estruturalmente válido (sem problemas)', () => {
    const problems = validateOpenApiDocument(buildOpenApiDocument());
    expect(problems, problems.join('\n')).toEqual([]);
  });

  it('cada endpoint tem resposta de erro padronizada (ApiErrorResponse)', () => {
    const doc = buildOpenApiDocument();
    const paths = doc.paths as Record<string, Record<string, { responses: Record<string, unknown> }>>;
    for (const [path, item] of Object.entries(paths)) {
      for (const [method, op] of Object.entries(item)) {
        const codes = Object.keys(op.responses);
        expect(codes, `${method} ${path}`).toContain('422');
        expect(codes, `${method} ${path}`).toContain('403');
      }
    }
  });

  it('o arquivo docs/api/openapi-v1.yaml está em sincronia com os contratos', () => {
    const onDisk = yaml.load(readFileSync('docs/api/openapi-v1.yaml', 'utf8'));
    expect(onDisk).toEqual(buildOpenApiDocument());
  });
});
