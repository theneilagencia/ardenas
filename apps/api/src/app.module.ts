/**
 * Arden.AS API — módulo raiz (ARDEN-BE-001).
 * Compõe configuração, logging, banco, health, meta, docs e idempotência.
 * Registra o filtro global de exceções e o middleware de correlation-id.
 */

import { Module, type MiddlewareConsumer, type NestModule } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { ConfigModule } from './config/config.module';
import { LoggerModule } from './common/logging/logger.module';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { MetaModule } from './meta/meta.module';
import { DocsModule } from './docs/docs.module';
import { IdempotencyModule } from './modules/idempotency/idempotency.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { CorrelationIdMiddleware } from './common/middleware/correlation-id.middleware';

@Module({
  imports: [
    ConfigModule,
    LoggerModule,
    DatabaseModule,
    HealthModule,
    MetaModule,
    DocsModule.register(),
    IdempotencyModule,
  ],
  providers: [{ provide: APP_FILTER, useClass: AllExceptionsFilter }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
