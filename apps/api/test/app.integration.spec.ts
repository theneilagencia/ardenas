/**
 * Arden.AS API — testes de integração da fundação (ARDEN-BE-001).
 * App real + Fastify + PostgreSQL (banco de teste).
 */

import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { startTestApp } from './test-app';

let app: NestFastifyApplication;
let server: ReturnType<NestFastifyApplication['getHttpServer']>;

beforeAll(async () => {
  app = await startTestApp();
  server = app.getHttpServer();
});

afterAll(async () => {
  await app.close();
});

describe('health & readiness', () => {
  it('GET /health retorna 200 e status ok', async () => {
    const res = await request(server).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok', service: 'arden-api' });
  });

  it('GET /ready retorna 200 com banco disponível', async () => {
    const res = await request(server).get('/ready');
    expect(res.status).toBe(200);
    // ARDEN-PRD-001.1D: checks sanitizados 'pass'/'fail'; inclui o preflight do keyring.
    expect(res.body.checks.database).toBe('pass');
    expect(res.body.checks.connectorMasterKeyring).toBe('pass');
  });
});

describe('meta', () => {
  it('GET /api/v1/meta retorna a versão da API', async () => {
    const res = await request(server).get('/api/v1/meta');
    expect(res.status).toBe(200);
    expect(res.body.apiVersion).toBe('v1');
    expect(res.body.appVersion).toBeTruthy();
  });
});

describe('correlation id', () => {
  it('preserva o id enviado pelo cliente', async () => {
    const res = await request(server).get('/health').set('X-Correlation-Id', 'client-corr-1');
    expect(res.headers['x-correlation-id']).toBe('client-corr-1');
  });

  it('gera um id quando ausente', async () => {
    const res = await request(server).get('/health');
    expect(res.headers['x-correlation-id']).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe('erros padronizados', () => {
  it('rota desconhecida retorna o envelope ApiErrorResponse com correlationId', async () => {
    const res = await request(server).get('/api/v1/rota-inexistente');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('RESOURCE_NOT_FOUND');
    expect(res.body.error.correlationId).toBeTruthy();
  });

  it('o corpo de erro NÃO expõe stack trace', async () => {
    const res = await request(server).get('/api/v1/rota-inexistente');
    const raw = JSON.stringify(res.body);
    expect(raw).not.toContain('stack');
    expect(raw).not.toMatch(/at .+\(.+:\d+:\d+\)/);
    expect(Object.keys(res.body.error).sort()).toEqual(['code', 'correlationId', 'message']);
  });

  it('o erro inclui o correlationId enviado', async () => {
    const res = await request(server)
      .get('/api/v1/rota-inexistente')
      .set('X-Correlation-Id', 'err-corr-9');
    expect(res.body.error.correlationId).toBe('err-corr-9');
  });
});

describe('CORS por allowlist', () => {
  it('permite origem autorizada', async () => {
    const res = await request(server).get('/health').set('Origin', 'http://allowed.test');
    expect(res.headers['access-control-allow-origin']).toBe('http://allowed.test');
  });

  it('bloqueia origem não autorizada (sem cabeçalho CORS)', async () => {
    const res = await request(server).get('/health').set('Origin', 'http://evil.test');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});

describe('OpenAPI servida', () => {
  it('GET /api/docs/openapi.json retorna um documento OpenAPI válido', async () => {
    const res = await request(server).get('/api/docs/openapi.json');
    expect(res.status).toBe(200);
    expect(res.body.openapi).toMatch(/^3\./);
    expect(res.body.info?.title).toBeTruthy();
    expect(Object.keys(res.body.paths ?? {}).length).toBeGreaterThan(0);
    expect(res.body.components?.schemas).toBeTruthy();
  });
});
