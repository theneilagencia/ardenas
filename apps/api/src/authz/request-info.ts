/** Arden.AS API — extração segura de metadados de requisição (ARDEN-BE-002). */

import type { FastifyRequest } from 'fastify';
import { CORRELATION_ID_HEADER } from '../common/constants';

export function requestCorrelationId(req: FastifyRequest): string {
  const raw = req.raw as { correlationId?: string };
  if (raw.correlationId) return raw.correlationId;
  const header = req.headers[CORRELATION_ID_HEADER];
  return (Array.isArray(header) ? header[0] : header) ?? 'unknown';
}

export function requestIp(req: FastifyRequest): string | null {
  return req.ip ?? null;
}

export function requestUserAgent(req: FastifyRequest): string | null {
  const ua = req.headers['user-agent'];
  return (Array.isArray(ua) ? ua[0] : ua) ?? null;
}

/** Extrai o Bearer token do header Authorization (ou null). */
export function extractBearerToken(authorization: unknown): string | null {
  if (typeof authorization !== 'string') return null;
  const [scheme, value] = authorization.split(' ');
  if (scheme !== 'Bearer' || !value) return null;
  return value.trim();
}
