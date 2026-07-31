/**
 * Arden.AS API — configuração da aplicação (ARDEN-BE-001).
 * Aplica logger, segurança (helmet), CORS por allowlist, prefixo da API e
 * graceful shutdown. Compartilhado por `main.ts` e pelos testes de integração.
 */

import helmet from '@fastify/helmet';
import { RequestMethod } from '@nestjs/common';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { Logger } from 'nestjs-pino';
import type { AppConfig } from './config/env.schema';

export async function buildApp(app: NestFastifyApplication, config: AppConfig): Promise<void> {
  // Logger estruturado (Pino) como logger da aplicação.
  app.useLogger(app.get(Logger));
  app.flushLogs();

  // Cabeçalhos seguros.
  await app.register(helmet, { contentSecurityPolicy: false });

  // CORS por allowlist. Em production nunca "*": origens não listadas são negadas.
  const allow = new Set(config.corsOrigins);
  app.enableCors({
    origin: (origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) => {
      if (!origin) return cb(null, true); // curl / server-to-server / same-origin
      if (allow.has(origin)) return cb(null, true);
      return cb(null, false); // sem cabeçalhos CORS → o navegador bloqueia
    },
    credentials: true,
  });

  // Prefixo /api/v1; health/ready/docs ficam fora do prefixo.
  app.setGlobalPrefix(config.API_PREFIX, {
    exclude: [
      { path: 'health', method: RequestMethod.GET },
      { path: 'ready', method: RequestMethod.GET },
      { path: 'api/docs', method: RequestMethod.GET },
      { path: 'api/docs/openapi.json', method: RequestMethod.GET },
    ],
  });

  // Encerramento limpo (fecha conexões — ex.: Prisma).
  app.enableShutdownHooks();
}
