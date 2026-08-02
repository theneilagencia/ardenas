/**
 * Arden.AS API — módulo de conectores (ARDEN-BE-006.3).
 * Persistência: repositórios tenant-scoped, projeção do catálogo e application
 * services. SEM controllers HTTP nesta fase (services testados diretamente). Sem
 * cofre/criptografia/SecureHttpClient/worker/webhook público funcional.
 */

import { Module } from '@nestjs/common';
import { AuthzModule } from '../authz/authz.module';
import { AuditModule } from '../audit/audit.module';
import { IdempotencyModule } from '../modules/idempotency/idempotency.module';
import { PrismaService } from '../database/prisma.service';
import { APP_CONFIG } from '../config/config.module';
import type { AppConfig } from '../config/env.schema';
import { ConnectorDefinitionsRepository, ConnectorToolDefinitionsRepository } from './catalog/catalog.repository';
import { ConnectorKeyProvider } from './vault/connector-key-provider';
import { AppAesGcmVault } from './vault/app-aes-gcm.vault';
import { FakeVault } from './vault/fake.vault';
import { CredentialResolver } from './vault/credential-resolver';
import { SECRET_VAULT, type SecretVault } from './vault/secret-vault';
import { CredentialsController } from './connections/credentials.controller';
import { ConnectorCatalogProjector } from './catalog/connector-catalog.projector';
import { OrganizationConnectionsRepository, ConnectionCredentialVersionsRepository } from './connections/connections.repository';
import { ConnectionsService } from './connections/connections.service';
import { CredentialVersionsService } from './connections/credential-versions.service';
import { OrganizationToolBindingsRepository, OperationToolBindingsRepository } from './tool-bindings/tool-bindings.repository';
import { ToolBindingsService } from './tool-bindings/tool-bindings.service';
import { WebhookEndpointsRepository, WebhookDeliveriesRepository } from './webhooks/webhooks.repository';
import { WebhooksService } from './webhooks/webhooks.service';
import { WebhooksController } from './webhooks/webhooks.controller';
import { WebhookRateLimiter } from './webhooks/webhook-rate-limiter';
import { NodeSecureHttpClient } from './http/secure-http-client';
import { SECURE_HTTP_CLIENT } from './http/secure-http.types';
import { ToolBindingResolver } from './tools/tool-binding-resolver';
import { ConnectionResolver } from './tools/connection-resolver';
import { ExternalToolExecutor } from './tools/external-tool-executor';
import { ToolBindingsController } from './tool-bindings/tool-bindings.controller';

@Module({
  imports: [AuthzModule, AuditModule, IdempotencyModule],
  controllers: [CredentialsController, ToolBindingsController, WebhooksController],
  providers: [
    ConnectorDefinitionsRepository,
    ConnectorToolDefinitionsRepository,
    ConnectorCatalogProjector,
    OrganizationConnectionsRepository,
    ConnectionCredentialVersionsRepository,
    ConnectionsService,
    CredentialVersionsService,
    OrganizationToolBindingsRepository,
    OperationToolBindingsRepository,
    ToolBindingsService,
    WebhookEndpointsRepository,
    WebhookDeliveriesRepository,
    WebhooksService,
    WebhookRateLimiter,
    // Cofre de credenciais (ARDEN-BE-006.4).
    ConnectorKeyProvider,
    CredentialResolver,
    // Cliente HTTP seguro / prevenção SSRF (ARDEN-BE-006.5).
    { provide: SECURE_HTTP_CLIENT, useClass: NodeSecureHttpClient },
    // Execução de ferramenta externa (ARDEN-BE-006.6).
    ToolBindingResolver,
    ConnectionResolver,
    ExternalToolExecutor,
    {
      provide: SECRET_VAULT,
      inject: [APP_CONFIG, ConnectorKeyProvider, PrismaService],
      useFactory: (config: AppConfig, keys: ConnectorKeyProvider, prisma: PrismaService): SecretVault => {
        if (config.CONNECTOR_VAULT_PROVIDER === 'fake') {
          if (config.NODE_ENV === 'production') {
            throw new Error('CONNECTOR_VAULT_PROVIDER=fake é proibido em production.');
          }
          return new FakeVault();
        }
        // Sem fallback silencioso: qualquer valor != 'fake' é o provider real.
        return new AppAesGcmVault(prisma, keys);
      },
    },
  ],
  exports: [
    ConnectorCatalogProjector,
    ConnectionsService,
    CredentialVersionsService,
    ToolBindingsService,
    WebhooksService,
    ConnectorDefinitionsRepository,
    ConnectorToolDefinitionsRepository,
    OrganizationConnectionsRepository,
    ConnectionCredentialVersionsRepository,
    OrganizationToolBindingsRepository,
    OperationToolBindingsRepository,
    WebhookEndpointsRepository,
    WebhookDeliveriesRepository,
    WebhookRateLimiter,
    CredentialResolver,
    SECRET_VAULT,
    SECURE_HTTP_CLIENT,
    ToolBindingResolver,
    ConnectionResolver,
    ExternalToolExecutor,
    ToolBindingsService,
  ],
})
export class ConnectorsModule {}
