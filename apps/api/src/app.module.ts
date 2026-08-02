/**
 * Arden.AS API — módulo raiz (ARDEN-BE-001).
 * Compõe configuração, logging, banco, health, meta, docs e idempotência.
 * Registra o filtro global de exceções e o middleware de correlation-id.
 */

import { Module, type MiddlewareConsumer, type NestModule } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { ConfigModule } from './config/config.module';
import { LoggerModule } from './common/logging/logger.module';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { MetaModule } from './meta/meta.module';
import { DocsModule } from './docs/docs.module';
import { IdempotencyModule } from './modules/idempotency/idempotency.module';
import { AuthzModule } from './authz/authz.module';
import { SessionModule } from './session/session.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { OperationsModule } from './operations/operations.module';
import { AuditModule } from './audit/audit.module';
import { PoliciesModule } from './policies/policies.module';
import { EnforcementModule } from './enforcement/enforcement.module';
import { ApprovalsModule } from './approvals/approvals.module';
import { ExecutionsModule } from './executions/executions.module';
import { ConnectorsModule } from './connectors/connectors.module';
import { WebhooksInboundModule } from './connectors/webhooks/webhooks-inbound.module';
import { AgentsModule } from './agents/agents.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { CorrelationIdMiddleware } from './common/middleware/correlation-id.middleware';

@Module({
  imports: [
    ConfigModule,
    LoggerModule,
    DatabaseModule,
    // Rate limit base (endpoints de sessão aplicam limite próprio, mais estrito).
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 200 }]),
    HealthModule,
    MetaModule,
    DocsModule.register(),
    IdempotencyModule,
    // Identidade e tenancy (ARDEN-BE-002). AuthzModule registra os guards globais.
    AuthzModule,
    SessionModule,
    OrganizationsModule,
    // Operações, versões, Gradiente de Autoridade e auditoria (ARDEN-BE-003).
    OperationsModule,
    AuditModule,
    // Governança e aprovações (ARDEN-BE-004).
    PoliciesModule,
    EnforcementModule,
    ApprovalsModule,
    // Motor de execução (ARDEN-BE-005).
    ExecutionsModule,
    // Conectores, credenciais, ferramentas e webhooks — persistência (ARDEN-BE-006.3).
    ConnectorsModule,
    WebhooksInboundModule,
    AgentsModule,
  ],
  providers: [{ provide: APP_FILTER, useClass: AllExceptionsFilter }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
