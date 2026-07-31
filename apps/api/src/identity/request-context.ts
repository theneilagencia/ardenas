/**
 * Arden.AS API — contexto de requisição autenticada (ARDEN-BE-002).
 *
 * Contexto por requisição, anexado ao objeto Request do Fastify (NÃO é variável
 * global; não vaza entre requests concorrentes). Os guards o populam em etapas
 * (autenticação → usuário → organização → permissões); o domínio o consome.
 * Permissões e tenant vêm SEMPRE do servidor, nunca do cliente.
 */

import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';

export interface AuthenticatedRequestContext {
  correlationId: string;
  userId: string;
  externalSubject: string;
  organizationId: string | null;
  membershipId: string | null;
  permissions: ReadonlySet<string>;
  ipAddress: string | null;
  userAgent: string | null;
  /** Expiração do token de identidade (ISO), exposta em /session. */
  identityExpiresAt: string | null;
}

const KEY = 'ardenContext';

type WithContext = FastifyRequest & { [KEY]?: AuthenticatedRequestContext };

export function attachContext(req: FastifyRequest, ctx: AuthenticatedRequestContext): void {
  (req as WithContext)[KEY] = ctx;
}

export function getContext(req: FastifyRequest): AuthenticatedRequestContext | null {
  return (req as WithContext)[KEY] ?? null;
}

export function requireContext(req: FastifyRequest): AuthenticatedRequestContext {
  const ctx = getContext(req);
  if (!ctx) throw new Error('Contexto de requisição ausente.');
  return ctx;
}

/** Injeta o `AuthenticatedRequestContext` em um handler. */
export const CurrentContext = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedRequestContext =>
    requireContext(ctx.switchToHttp().getRequest<FastifyRequest>()),
);
