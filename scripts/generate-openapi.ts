/**
 * Arden.AS — gera docs/api/openapi-v1.yaml a partir dos contratos (ARDEN-FE-003).
 * Uso: `npm run contracts:openapi` (via vite-node). Sem handlers, sem servidor.
 */

import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as yaml from 'js-yaml';
import { buildOpenApiDocument } from '../src/contracts/openapi/build-openapi';
import { validateOpenApiDocument } from '../src/contracts/openapi/validate-openapi';

const doc = buildOpenApiDocument();
const problems = validateOpenApiDocument(doc);
if (problems.length > 0) {
  console.error('OpenAPI inválido:\n' + problems.map((p) => ` - ${p}`).join('\n'));
  process.exit(1);
}

const out = resolve(process.cwd(), 'docs/api/openapi-v1.yaml');
const banner =
  '# Arden.AS — OpenAPI v1 (ARDEN-FE-003)\n' +
  '# GERADO a partir de src/contracts (fonte única). Não editar à mão.\n' +
  '# Regenerar: npm run contracts:openapi\n';
writeFileSync(out, banner + yaml.dump(doc, { noRefs: true, lineWidth: 120 }), 'utf8');
console.log(`OpenAPI válido — ${Object.keys(doc.paths as object).length} paths escritos em ${out}`);
