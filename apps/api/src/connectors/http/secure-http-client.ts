/**
 * Arden.AS API — cliente HTTP seguro (ARDEN-BE-006.5).
 *
 * Conexão FIXADA ao IP validado (anti-DNS-rebinding), timeout, limites de request/
 * response, redirects controlados (desligados por padrão e revalidados a cada salto),
 * headers permitidos (bloqueia Host/Content-Length/proxy/forwarding), user-agent
 * identificável e correlationId. Sem streaming/download ilimitado. NÃO executa
 * ferramentas nem é ligado ao worker nesta fase.
 */

import { Injectable } from '@nestjs/common';
import { request as httpRequest, type IncomingMessage } from 'node:http';
import { request as httpsRequest } from 'node:https';
import type { LookupFunction } from 'node:net';
import {
  redirectDenied, requestTooLarge, responseTooLarge, externalTimeout, externalProviderError,
} from '../../common/errors/api-error';
import { validateTarget, type ValidatedTarget } from './ssrf-guard';
import type { ConnectorExecutionContext, SecureHttpClient, SecureHttpPolicy, SecureHttpRequest, SecureHttpResponse } from './secure-http.types';

const USER_AGENT = 'Arden.AS-Connector/1.0';
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
// Headers que o CHAMADOR nunca controla (injetados/derivados pelo runtime).
const FORBIDDEN_REQUEST_HEADERS = new Set([
  'host', 'content-length', 'connection', 'keep-alive', 'proxy-connection', 'proxy-authorization',
  'transfer-encoding', 'te', 'upgrade', 'forwarded', 'x-forwarded-for', 'x-forwarded-host',
  'x-forwarded-proto', 'x-forwarded-port',
]);

interface RawResponse {
  status: number;
  headers: Record<string, string>;
  body: string;
}

@Injectable()
export class NodeSecureHttpClient implements SecureHttpClient {
  async execute(request: SecureHttpRequest, policy: SecureHttpPolicy, context: ConnectorExecutionContext): Promise<SecureHttpResponse> {
    return this.dispatch(request.url, request, policy, context, 0);
  }

  private async dispatch(
    currentUrl: string,
    request: SecureHttpRequest,
    policy: SecureHttpPolicy,
    context: ConnectorExecutionContext,
    redirectCount: number,
  ): Promise<SecureHttpResponse> {
    const target = await validateTarget(currentUrl, policy);

    const body = request.body;
    if (body && Buffer.byteLength(body, 'utf8') > policy.maximumRequestBytes) throw requestTooLarge();

    const raw = await this.raw(target, request, body, policy, context);

    if (REDIRECT_STATUSES.has(raw.status)) {
      if (!policy.allowRedirects || redirectCount >= policy.maximumRedirects) throw redirectDenied();
      const location = raw.headers['location'];
      if (!location) throw redirectDenied();
      const nextUrl = new URL(location, target.url).toString();
      // 303 (e 301/302 por convenção) → GET sem corpo; 307/308 preservam método/corpo.
      const preserve = raw.status === 307 || raw.status === 308;
      const nextRequest: SecureHttpRequest = preserve
        ? { ...request, url: nextUrl }
        : { ...request, url: nextUrl, method: 'GET', body: undefined };
      return this.dispatch(nextUrl, nextRequest, policy, context, redirectCount + 1);
    }

    return { status: raw.status, headers: raw.headers, body: raw.body, finalUrl: target.url.toString() };
  }

  private raw(
    target: ValidatedTarget,
    request: SecureHttpRequest,
    body: string | undefined,
    policy: SecureHttpPolicy,
    context: ConnectorExecutionContext,
  ): Promise<RawResponse> {
    const isHttps = target.url.protocol === 'https:';
    const doRequest = isHttps ? httpsRequest : httpRequest;

    // Fixa a resolução ao IP validado (o socket conecta SÓ nesse IP).
    const pinnedLookup: LookupFunction = (_hostname, _options, cb) => {
      (cb as (err: NodeJS.ErrnoException | null, address: string, family: number) => void)(null, target.pinnedIp, target.family);
    };

    const headers: Record<string, string> = {
      'user-agent': USER_AGENT,
      'x-correlation-id': context.correlationId,
      accept: 'application/json, */*;q=0.1',
    };
    for (const [k, v] of Object.entries(request.headers ?? {})) {
      if (!FORBIDDEN_REQUEST_HEADERS.has(k.toLowerCase())) headers[k] = v;
    }
    if (request.idempotencyKey) headers['idempotency-key'] = request.idempotencyKey;
    if (body !== undefined && !('content-type' in Object.fromEntries(Object.entries(headers).map(([k]) => [k.toLowerCase(), true])))) {
      headers['content-type'] = 'application/json';
    }

    return new Promise<RawResponse>((resolve, reject) => {
      const req = doRequest(
        {
          method: request.method,
          hostname: target.host,
          port: target.port,
          path: `${target.url.pathname}${target.url.search}`,
          headers,
          lookup: pinnedLookup,
          servername: isHttps ? target.host : undefined,
          timeout: policy.timeoutMs,
        },
        (res: IncomingMessage) => {
          const declared = Number(res.headers['content-length'] ?? '0');
          if (declared > policy.maximumResponseBytes) {
            res.destroy();
            reject(responseTooLarge());
            return;
          }
          const chunks: Buffer[] = [];
          let received = 0;
          res.on('data', (chunk: Buffer) => {
            received += chunk.length;
            if (received > policy.maximumResponseBytes) {
              res.destroy();
              reject(responseTooLarge());
              return;
            }
            chunks.push(chunk);
          });
          res.on('end', () => {
            const outHeaders: Record<string, string> = {};
            for (const [k, v] of Object.entries(res.headers)) outHeaders[k] = Array.isArray(v) ? v.join(', ') : String(v ?? '');
            resolve({ status: res.statusCode ?? 0, headers: outHeaders, body: Buffer.concat(chunks).toString('utf8') });
          });
          res.on('error', () => reject(externalProviderError()));
        },
      );

      req.on('timeout', () => {
        req.destroy(new Error('timeout'));
      });
      req.on('error', (err: NodeJS.ErrnoException & { _ardenTimeout?: boolean }) => {
        if (err.message === 'timeout') reject(externalTimeout());
        else reject(externalProviderError());
      });
      if (body !== undefined) req.write(body);
      req.end();
    });
  }
}
