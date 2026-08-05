/**
 * Arden.AS API — carregador do contrato OpenAPI (ARDEN-BE-001).
 *
 * Serve o CONTRATO EXISTENTE (`docs/api/openapi-v1.yaml`, gerado no ARDEN-FE-003).
 * NÃO gera uma segunda especificação divergente. Carregado uma vez e cacheado.
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import * as yaml from 'js-yaml';

const RELATIVE = 'docs/api/openapi-v1.yaml';

/** Encontra o arquivo do contrato subindo diretórios a partir de um ponto inicial. */
export function resolveOpenApiPath(startDir: string = __dirname): string {
  const override = process.env.OPENAPI_PATH;
  if (override && existsSync(override)) return override;
  let dir = startDir;
  for (let i = 0; i < 12; i += 1) {
    const candidate = resolve(dir, RELATIVE);
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error(`Contrato OpenAPI não encontrado (${RELATIVE}).`);
}

let cached: Record<string, unknown> | null = null;

export function loadOpenApiDocument(): Record<string, unknown> {
  if (cached) return cached;
  const path = resolveOpenApiPath();
  cached = yaml.load(readFileSync(path, 'utf8')) as Record<string, unknown>;
  return cached;
}
