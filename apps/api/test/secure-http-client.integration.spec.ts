/**
 * Arden.AS API — integração do cliente HTTP seguro (ARDEN-BE-006.5).
 *
 * Usa um servidor HTTP LOCAL efêmero (nunca a internet). A política de teste habilita
 * `http` + loopback explicitamente (política de desenvolvimento). Cobre: sucesso,
 * timeout, limite de resposta (declarado e por streaming), limite de request, controle
 * de redirect (bloqueado por padrão, permitido com limite, revalidado por salto para
 * IP privado), headers proibidos removidos e user-agent injetado.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { AddressInfo } from 'node:net';
import { NodeSecureHttpClient } from '../src/connectors/http/secure-http-client';
import type { ConnectorExecutionContext, SecureHttpPolicy } from '../src/connectors/http/secure-http.types';

type Handler = (req: IncomingMessage, res: ServerResponse) => void;

let server: Server;
let port: number;
let handler: Handler = (_req, res) => res.end();
const seenRequests: Array<{ url?: string; method?: string; headers: IncomingMessage['headers']; body: string }> = [];

const client = new NodeSecureHttpClient();
const context: ConnectorExecutionContext = { organizationId: 'org_1', correlationId: 'corr-123' };

function devPolicy(overrides: Partial<SecureHttpPolicy> = {}): SecureHttpPolicy {
  return {
    allowedProtocols: ['http'],
    allowedHosts: ['127.0.0.1'],
    allowedPorts: [port],
    allowRedirects: false,
    maximumRedirects: 0,
    allowPrivateNetworks: false,
    allowLoopback: true,
    allowLinkLocal: false,
    maximumRequestBytes: 1_048_576,
    maximumResponseBytes: 5_242_880,
    timeoutMs: 2_000,
    ...overrides,
  };
}

const url = (path = '/') => `http://127.0.0.1:${port}${path}`;

beforeAll(async () => {
  server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      seenRequests.push({ url: req.url, method: req.method, headers: req.headers, body: Buffer.concat(chunks).toString('utf8') });
      handler(req, res);
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  port = (server.address() as AddressInfo).port;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
});

describe('NodeSecureHttpClient — sucesso', () => {
  it('faz GET e retorna corpo, status e finalUrl', async () => {
    handler = (_req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    };
    const resp = await client.execute({ url: url('/data'), method: 'GET' }, devPolicy(), context);
    expect(resp.status).toBe(200);
    expect(JSON.parse(resp.body)).toEqual({ ok: true });
    expect(resp.finalUrl).toContain('/data');
  });

  it('injeta user-agent e correlation-id, remove headers proibidos', async () => {
    seenRequests.length = 0;
    handler = (_req, res) => res.end('ok');
    await client.execute(
      { url: url('/'), method: 'GET', headers: { host: 'evil.example', 'x-forwarded-for': '1.2.3.4', 'x-custom': 'keep' } },
      devPolicy(),
      context,
    );
    const seen = seenRequests.at(-1)!;
    expect(seen.headers['user-agent']).toBe('Arden.AS-Connector/1.0');
    expect(seen.headers['x-correlation-id']).toBe('corr-123');
    expect(seen.headers['x-custom']).toBe('keep');
    // Host proibido do chamador NÃO sobrescreve o host real (127.0.0.1:port).
    expect(seen.headers['host']).toContain('127.0.0.1');
    expect(seen.headers['x-forwarded-for']).toBeUndefined();
  });

  it('envia corpo e content-type padrão em POST', async () => {
    seenRequests.length = 0;
    handler = (_req, res) => res.end('ok');
    await client.execute({ url: url('/'), method: 'POST', body: JSON.stringify({ a: 1 }) }, devPolicy(), context);
    const seen = seenRequests.at(-1)!;
    expect(seen.method).toBe('POST');
    expect(seen.headers['content-type']).toBe('application/json');
    expect(JSON.parse(seen.body)).toEqual({ a: 1 });
  });
});

describe('NodeSecureHttpClient — timeout', () => {
  it('estoura EXTERNAL_TIMEOUT quando o servidor não responde a tempo', async () => {
    handler = () => { /* nunca responde */ };
    await expect(
      client.execute({ url: url('/hang'), method: 'GET' }, devPolicy({ timeoutMs: 300 }), context),
    ).rejects.toMatchObject({ code: 'EXTERNAL_TIMEOUT' });
  });
});

describe('NodeSecureHttpClient — limites de payload', () => {
  it('rejeita RESPONSE_TOO_LARGE por content-length declarado', async () => {
    handler = (_req, res) => {
      res.writeHead(200, { 'content-length': '5000' });
      res.end('x'.repeat(5000));
    };
    await expect(
      client.execute({ url: url('/big'), method: 'GET' }, devPolicy({ maximumResponseBytes: 1000 }), context),
    ).rejects.toMatchObject({ code: 'RESPONSE_TOO_LARGE' });
  });

  it('rejeita RESPONSE_TOO_LARGE por streaming (sem content-length)', async () => {
    handler = (_req, res) => {
      res.writeHead(200);
      res.write('x'.repeat(800));
      res.write('y'.repeat(800));
      res.end();
    };
    await expect(
      client.execute({ url: url('/stream'), method: 'GET' }, devPolicy({ maximumResponseBytes: 1000 }), context),
    ).rejects.toMatchObject({ code: 'RESPONSE_TOO_LARGE' });
  });

  it('rejeita REQUEST_TOO_LARGE antes de enviar', async () => {
    handler = (_req, res) => res.end('ok');
    await expect(
      client.execute(
        { url: url('/'), method: 'POST', body: 'x'.repeat(2000) },
        devPolicy({ maximumRequestBytes: 1000 }),
        context,
      ),
    ).rejects.toMatchObject({ code: 'REQUEST_TOO_LARGE' });
  });
});

describe('NodeSecureHttpClient — redirects', () => {
  it('bloqueia redirect por padrão (REDIRECT_DENIED)', async () => {
    handler = (_req, res) => {
      res.writeHead(302, { location: url('/final') });
      res.end();
    };
    await expect(
      client.execute({ url: url('/start'), method: 'GET' }, devPolicy(), context),
    ).rejects.toMatchObject({ code: 'REDIRECT_DENIED' });
  });

  it('segue redirect validado quando permitido e revalida o destino', async () => {
    handler = (req, res) => {
      if (req.url === '/start') {
        res.writeHead(302, { location: url('/final') });
        res.end();
      } else {
        res.writeHead(200);
        res.end('chegou');
      }
    };
    const resp = await client.execute(
      { url: url('/start'), method: 'GET' },
      devPolicy({ allowRedirects: true, maximumRedirects: 3 }),
      context,
    );
    expect(resp.status).toBe(200);
    expect(resp.body).toBe('chegou');
    expect(resp.finalUrl).toContain('/final');
  });

  it('bloqueia redirect para IP privado mesmo com redirects habilitados', async () => {
    handler = (_req, res) => {
      res.writeHead(302, { location: 'http://169.254.169.254/latest/meta-data/' });
      res.end();
    };
    // Host allowlist ampla força a revalidação a chegar na classificação de IP:
    // o salto para o serviço de metadata é barrado pelo IP, não pela allowlist.
    await expect(
      client.execute(
        { url: url('/start'), method: 'GET' },
        devPolicy({ allowRedirects: true, maximumRedirects: 3, allowedHosts: ['*'], allowedPorts: [port, 80], allowLinkLocal: true }),
        context,
      ),
    ).rejects.toMatchObject({ code: 'SSRF_BLOCKED' });
  });

  it('estoura REDIRECT_DENIED ao exceder o máximo de saltos', async () => {
    handler = (req, res) => {
      const n = Number(new URL(req.url ?? '/', url()).searchParams.get('n') ?? '0');
      res.writeHead(302, { location: url(`/hop?n=${n + 1}`) });
      res.end();
    };
    await expect(
      client.execute(
        { url: url('/hop?n=0'), method: 'GET' },
        devPolicy({ allowRedirects: true, maximumRedirects: 2 }),
        context,
      ),
    ).rejects.toMatchObject({ code: 'REDIRECT_DENIED' });
  });
});

describe('NodeSecureHttpClient — política de rede aplicada', () => {
  it('rejeita host fora da allowlist (HOST_NOT_ALLOWED)', async () => {
    await expect(
      client.execute({ url: url('/'), method: 'GET' }, devPolicy({ allowedHosts: ['api.exemplo.com'] }), context),
    ).rejects.toMatchObject({ code: 'HOST_NOT_ALLOWED' });
  });

  it('rejeita loopback quando allowLoopback está desligado', async () => {
    await expect(
      client.execute({ url: url('/'), method: 'GET' }, devPolicy({ allowLoopback: false }), context),
    ).rejects.toMatchObject({ code: 'PRIVATE_NETWORK_DENIED' });
  });
});
