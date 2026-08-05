/**
 * Arden.AS API — correlation id (ARDEN-BE-001).
 *
 * Aceita `X-Correlation-Id` válido do cliente; gera UUID quando ausente/ inválido;
 * devolve no header da resposta; disponibiliza em `req.correlationId` para logs e
 * erros. Não confia em strings arbitrariamente grandes.
 */

import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import { CORRELATION_ID_HEADER, CORRELATION_ID_MAX_LENGTH } from '../constants';

const VALID = /^[\w.\-:]{1,200}$/;

export function resolveCorrelationId(raw: unknown): string {
  if (typeof raw === 'string' && raw.length <= CORRELATION_ID_MAX_LENGTH && VALID.test(raw)) {
    return raw;
  }
  return uuidv4();
}

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: FastifyRequest['raw'] & { correlationId?: string; headers: Record<string, unknown> }, res: FastifyReply['raw'], next: () => void): void {
    const incoming = req.headers[CORRELATION_ID_HEADER];
    const correlationId = resolveCorrelationId(Array.isArray(incoming) ? incoming[0] : incoming);
    req.correlationId = correlationId;
    res.setHeader(CORRELATION_ID_HEADER, correlationId);
    next();
  }
}
