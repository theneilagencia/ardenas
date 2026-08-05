/**
 * Arden.AS API — bootstrap (ARDEN-BE-001).
 *
 * NestJS + Fastify. Configuração validada, logging estruturado (Pino), CORS por
 * allowlist, helmet, limite de body, timeout, prefixo /api/v1 (health/ready/docs
 * fora do prefixo) e graceful shutdown. Falhas de inicialização NÃO são
 * silenciadas.
 */

import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module';
import { loadConfig } from './config/env.schema';
import { BODY_LIMIT_BYTES } from './common/constants';
import { buildApp } from './bootstrap';

export async function createApp(): Promise<NestFastifyApplication> {
  const config = loadConfig();
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ bodyLimit: BODY_LIMIT_BYTES, requestTimeout: 30_000 }),
    // rawBody: preserva os bytes ORIGINAIS do corpo (necessário para verificar a
    // assinatura HMAC de webhooks de entrada sobre o raw body, nunca reserializado).
    { bufferLogs: true, rawBody: true },
  );
  await buildApp(app, config);
  return app;
}

async function bootstrap(): Promise<void> {
  const app = await createApp();
  const config = loadConfig();
  await app.listen(config.PORT, '0.0.0.0');
}

// Executa apenas quando chamado diretamente.
if (require.main === module) {
  bootstrap().catch((err) => {
    // Não silenciar erros de inicialização.
    console.error('Falha ao iniciar a API:', err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
