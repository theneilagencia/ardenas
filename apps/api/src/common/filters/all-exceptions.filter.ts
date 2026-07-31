/**
 * Arden.AS API — filtro global de exceções (ARDEN-BE-001).
 *
 * Serializa QUALQUER erro no envelope `ApiErrorResponse` do contrato, com
 * `correlationId` sempre presente. NUNCA retorna stack trace, SQL, path local,
 * segredo ou objeto bruto de erro. Loga o erro sanitizado com o correlationId.
 */

import {
  Catch,
  HttpException,
  Logger,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import {
  ERROR_HTTP_STATUS,
  type ApiErrorCode,
  type ApiErrorResponse,
  type FieldError,
} from '@arden/contracts';
import { ApiException } from '../errors/api-error';
import { CORRELATION_ID_HEADER } from '../constants';
import { resolveCorrelationId } from '../middleware/correlation-id.middleware';

const HTTP_STATUS_TO_CODE: Record<number, ApiErrorCode> = {
  400: 'VALIDATION_ERROR',
  401: 'UNAUTHENTICATED',
  403: 'FORBIDDEN',
  404: 'RESOURCE_NOT_FOUND',
  409: 'RESOURCE_CONFLICT',
  422: 'VALIDATION_ERROR',
  429: 'RATE_LIMITED',
  503: 'DEPENDENCY_UNAVAILABLE',
};

interface RawWithCorrelation {
  correlationId?: string;
  headers?: Record<string, unknown>;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const reply = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<FastifyRequest>();
    const correlationId = this.correlationId(request, reply);

    const { status, code, message, details, fieldErrors, internal } =
      this.normalize(exception);

    const body: ApiErrorResponse = {
      error: {
        code,
        message,
        correlationId,
        ...(details ? { details } : {}),
        ...(fieldErrors ? { fieldErrors } : {}),
      },
    };

    // Log sanitizado (sem vazar detalhes internos ao cliente).
    if (status >= 500) {
      this.logger.error(
        { correlationId, code, err: internal instanceof Error ? internal.message : String(internal) },
        'unhandled error',
      );
    } else {
      this.logger.warn({ correlationId, code, status }, 'request error');
    }

    reply.header(CORRELATION_ID_HEADER, correlationId);
    void reply.status(status).send(body);
  }

  private correlationId(request: FastifyRequest, reply: FastifyReply): string {
    const fromReply = reply.getHeader?.(CORRELATION_ID_HEADER);
    if (typeof fromReply === 'string' && fromReply) return fromReply;
    const raw = request.raw as unknown as RawWithCorrelation;
    if (raw?.correlationId) return raw.correlationId;
    const header = (request.headers ?? {})[CORRELATION_ID_HEADER];
    return resolveCorrelationId(Array.isArray(header) ? header[0] : header);
  }

  private normalize(exception: unknown): {
    status: number;
    code: ApiErrorCode;
    message: string;
    details?: Record<string, unknown>;
    fieldErrors?: FieldError[];
    internal: unknown;
  } {
    if (exception instanceof ApiException) {
      return {
        status: exception.httpStatus,
        code: exception.code,
        message: exception.message,
        details: exception.details,
        fieldErrors: exception.fieldErrors,
        internal: exception,
      };
    }

    if (exception instanceof ZodError) {
      return {
        status: ERROR_HTTP_STATUS.VALIDATION_ERROR,
        code: 'VALIDATION_ERROR',
        message: 'Dados inválidos.',
        fieldErrors: exception.issues.map((i) => ({
          field: i.path.join('.') || '(root)',
          code: i.code,
          message: i.message,
        })),
        internal: exception,
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const code = HTTP_STATUS_TO_CODE[status] ?? 'INTERNAL_ERROR';
      // Mensagem segura (não repassa objeto bruto do Nest).
      const message = this.safeHttpMessage(exception, code);
      return { status, code, message, internal: exception };
    }

    // Desconhecido → interno, sem vazar detalhes.
    return {
      status: ERROR_HTTP_STATUS.INTERNAL_ERROR,
      code: 'INTERNAL_ERROR',
      message: 'Erro interno.',
      internal: exception,
    };
  }

  private safeHttpMessage(exception: HttpException, code: ApiErrorCode): string {
    if (code === 'RESOURCE_NOT_FOUND') return 'Recurso não encontrado.';
    if (code === 'VALIDATION_ERROR') return 'Dados inválidos.';
    if (code === 'UNAUTHENTICATED') return 'Não autenticado.';
    if (code === 'FORBIDDEN') return 'Acesso negado.';
    if (code === 'RATE_LIMITED') return 'Muitas requisições.';
    const raw = exception.message;
    return typeof raw === 'string' && raw.length < 200 ? raw : 'Erro na requisição.';
  }
}
