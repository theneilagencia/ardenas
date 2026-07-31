/**
 * Arden.AS — API v1 · contexto de requisição e headers (ARDEN-FE-003).
 *
 * IMPORTANTE: o CLIENTE não envia permissões e não escolhe o tenant arbitrariamente.
 * O SERVIDOR deriva usuário, organização e permissões da sessão autenticada. Este
 * arquivo modela (a) os headers que o cliente pode/deve enviar e (b) o contexto
 * que o servidor DERIVA (documental — não é payload de request).
 */

import { z } from 'zod';
import { correlationId, idempotencyKey, organizationId, userId } from './identifiers';

/**
 * Headers do protocolo v1.
 * - `Authorization`: Bearer token OU sessão equivalente (não amarrado a fornecedor).
 * - `X-Correlation-Id`: cliente PODE enviar; servidor gera se ausente e ECOA na resposta.
 * - `Idempotency-Key`: OBRIGATÓRIO em comandos críticos (criar/duplicar/arquivar
 *   operação, criar versão, publicar).
 * - `If-Match`: concorrência otimista (revisão esperada) quando aplicável.
 */
export const requestHeaders = z.object({
  authorization: z.string().optional(),
  'x-correlation-id': correlationId.optional(),
  'idempotency-key': idempotencyKey.optional(),
  'if-match': z.string().optional(),
});
export type RequestHeaders = z.infer<typeof requestHeaders>;

/**
 * Contexto DERIVADO PELO SERVIDOR a partir da sessão autenticada. Nunca chega do
 * cliente. As `permissions` são resolvidas server-side (o cliente não as envia).
 */
export const serverRequestContext = z.object({
  userId,
  organizationId: organizationId.nullable(),
  correlationId,
  permissions: z.array(z.string()),
});
export type ServerRequestContext = z.infer<typeof serverRequestContext>;

/** Endpoints/estratégia onde o Idempotency-Key é obrigatório. */
export const IDEMPOTENT_COMMANDS = [
  'operations.create',
  'operations.duplicate',
  'operations.archive',
  'operationVersions.create',
  'operationVersions.publish',
] as const;
export type IdempotentCommand = (typeof IDEMPOTENT_COMMANDS)[number];
