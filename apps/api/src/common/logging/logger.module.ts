/**
 * Arden.AS API — logging estruturado (ARDEN-BE-001).
 *
 * Pino via nestjs-pino. Cada requisição registra método, path, status, duração,
 * correlationId, ambiente e versão. `Authorization`, cookies e tokens são
 * REDIGIDOS. Body completo não é logado por padrão.
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import { Module } from '@nestjs/common';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';
import { ConfigModule, APP_CONFIG } from '../../config/config.module';
import type { AppConfig } from '../../config/env.schema';
import { REDACT_PATHS } from '../constants';
import { resolveCorrelationId } from '../middleware/correlation-id.middleware';

type ReqWithId = IncomingMessage & { correlationId?: string };

@Module({
  imports: [
    PinoLoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [APP_CONFIG],
      useFactory: (cfg: AppConfig) => ({
        pinoHttp: {
          level: cfg.LOG_LEVEL,
          genReqId: (req: ReqWithId, res: ServerResponse) => {
            const existing = res.getHeader('x-correlation-id');
            const id =
              (typeof existing === 'string' && existing) ||
              req.correlationId ||
              resolveCorrelationId(req.headers['x-correlation-id']);
            if (!res.getHeader('x-correlation-id')) res.setHeader('x-correlation-id', id);
            req.correlationId = id;
            return id;
          },
          customProps: (req: IncomingMessage) => ({
            correlationId: (req as ReqWithId).correlationId,
            env: cfg.NODE_ENV,
            version: cfg.APP_VERSION,
          }),
          redact: { paths: REDACT_PATHS, censor: '[REDACTED]' },
          autoLogging: true,
          // Em desenvolvimento, saída legível; em produção, JSON puro.
          transport:
            cfg.NODE_ENV === 'development'
              ? { target: 'pino-pretty', options: { singleLine: true } }
              : undefined,
          serializers: {
            req(req: IncomingMessage) {
              return { method: req.method, url: req.url };
            },
          },
        },
      }),
    }),
  ],
})
export class LoggerModule {}
