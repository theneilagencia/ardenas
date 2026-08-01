/**
 * Arden.AS API — entrypoint do WORKER de execução (ARDEN-BE-005).
 *
 * Processo LÓGICO separado do API. Sobe um contexto Nest (sem servidor HTTP),
 * resolve o ExecutionWorker e roda o loop de aquisição/processamento/recuperação.
 * Pode compartilhar o mesmo deploy do API, mas é um processo distinto: o controller
 * cria/comanda execuções; este processo é quem executa as etapas.
 */

import { randomUUID } from 'node:crypto';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { ExecutionWorker } from './executions/execution.worker';

async function bootstrapWorker(): Promise<void> {
  const logger = new Logger('Worker');
  const app = await NestFactory.createApplicationContext(AppModule, { bufferLogs: false });
  const worker = app.get(ExecutionWorker);

  const opts = {
    workerId: process.env.WORKER_ID ?? `worker-${randomUUID()}`,
    leaseSeconds: Number(process.env.WORKER_LEASE_SECONDS ?? 30),
    pollIntervalMs: Number(process.env.WORKER_POLL_INTERVAL_MS ?? 1000),
  };

  const shutdown = async (signal: string) => {
    logger.log(`Recebido ${signal}; encerrando o worker...`);
    worker.stop();
    await app.close();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  await worker.start(opts);
}

// Guarda de entrypoint: só executa quando invocado como processo do worker.
if (process.env.ARDEN_WORKER === '1' || require.main === module) {
  bootstrapWorker().catch((err) => {
    console.error('Falha ao iniciar o worker:', err);
    process.exit(1);
  });
}
