/**
 * Arden.AS API — documentação OpenAPI servida (ARDEN-BE-001).
 *
 * `/api/docs/openapi.json` serve o contrato existente; `/api/docs` uma página
 * mínima (offline-safe) que aponta para o JSON. Pode ser desabilitado em
 * production (ENABLE_SWAGGER=false) — o registro do módulo respeita a flag.
 */

import { Controller, Get, Header } from '@nestjs/common';
import { loadOpenApiDocument } from './openapi-loader';

@Controller('api/docs')
export class DocsController {
  @Get('openapi.json')
  spec(): Record<string, unknown> {
    return loadOpenApiDocument();
  }

  @Get()
  @Header('content-type', 'text/html; charset=utf-8')
  index(): string {
    const doc = loadOpenApiDocument() as { info?: { title?: string; version?: string } };
    const title = doc.info?.title ?? 'Arden.AS API';
    const version = doc.info?.version ?? '1.0.0';
    return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<title>${title} — OpenAPI ${version}</title>
<meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="font-family:system-ui,sans-serif;max-width:720px;margin:40px auto;padding:0 16px;color:#222">
<h1>${title}</h1>
<p>OpenAPI <strong>${version}</strong> — contrato definitivo da API v1 (ARDEN-FE-003).</p>
<p>Especificação (JSON): <a href="/api/docs/openapi.json">/api/docs/openapi.json</a></p>
<p>Esta página é servida offline. Para uma UI interativa, aponte um Swagger UI ao JSON acima.</p>
</body></html>`;
  }
}
