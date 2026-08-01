/**
 * Arden.AS API — execução de comandos idempotentes transacionais (ARDEN-BE-003).
 *
 * Garante que um comando crítico (criar/duplicar/arquivar/criar versão/publicar):
 *  1. verifica a idempotência ANTES de executar (replay → devolve a resposta
 *     armazenada; body diferente → 409 IDEMPOTENCY_CONFLICT);
 *  2. executa TUDO (mutações + auditoria + registro de idempotência) em UMA única
 *     transação — se qualquer passo falhar, nada persiste (nem auditoria de
 *     sucesso, nem registro de idempotência).
 *
 * Escopo da chave = (método, rota org-scoped, `usuário:chave`) + hash do body,
 * cobrindo usuário + organização + método + rota + key + hash (a rota já contém o
 * organizationId, isolando tenants).
 */

import type { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import {
  IdempotencyService,
  hashRequestBody,
} from '../modules/idempotency/idempotency.service';
import { idempotencyConflict } from '../common/errors/api-error';

export interface IdempotentCommandParts {
  method: string;
  path: string;
  idempotencyKey: string;
  userId: string;
  organizationId: string;
}

export interface IdempotentCommandResult<T> {
  replayed: boolean;
  statusCode: number;
  response: T;
}

/**
 * Roda `command` de forma idempotente e transacional.
 *
 * Ordem: (1) verifica a idempotência — replay curto-circuita ANTES de qualquer
 * pré-checagem de estado (para que um retry legítimo não colida com o efeito do
 * primeiro); (2) `prepare` (opcional) roda apenas em requisições novas, FORA da
 * transação — é onde ficam pré-checagens/validações que podem rejeitar o comando;
 * (3) `command` roda na transação e DEVE gravar a auditoria pelo mesmo `tx`. A
 * resposta é armazenada integralmente para replays.
 */
export async function runIdempotentCommand<T, P = void>(
  deps: { idem: IdempotencyService; prisma: PrismaService },
  parts: IdempotentCommandParts,
  requestBody: unknown,
  statusCode: number,
  command: (tx: Prisma.TransactionClient, prepared: P) => Promise<T>,
  prepare?: () => Promise<P>,
): Promise<IdempotentCommandResult<T>> {
  const requestHash = hashRequestBody(requestBody);
  const scope = {
    method: parts.method,
    path: parts.path,
    idempotencyKey: `${parts.userId}:${parts.idempotencyKey}`,
  };

  const found = await deps.idem.check(scope, requestHash);
  if (found.outcome === 'replay') {
    return { replayed: true, statusCode: found.statusCode, response: found.response as T };
  }
  if (found.outcome === 'conflict') throw idempotencyConflict();

  const prepared = (prepare ? await prepare() : undefined) as P;

  const response = await deps.prisma.$transaction(async (tx) => {
    const result = await command(tx, prepared);
    await deps.idem.remember(
      {
        ...scope,
        organizationId: parts.organizationId,
        userId: parts.userId,
        requestHash,
        statusCode,
        response: result,
      },
      tx,
    );
    return result;
  });

  return { replayed: false, statusCode, response };
}
