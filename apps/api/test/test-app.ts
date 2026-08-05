/**
 * Arden.AS API — bootstrap da aplicação para testes de integração (ARDEN-BE-001).
 * Cria a aplicação real (Nest + Fastify) sem escutar porta; usa o banco de teste.
 */

import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { createApp } from '../src/main';

export async function startTestApp(): Promise<NestFastifyApplication> {
  const app = await createApp();
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  return app;
}
