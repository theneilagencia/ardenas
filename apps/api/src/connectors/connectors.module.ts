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
import { ConnectorDefinitionsRepository, ConnectorToolDefinitionsRepository } from './catalog/catalog.repository';
import { ConnectorCatalogProjector } from './catalog/connector-catalog.projector';
import { OrganizationConnectionsRepository, ConnectionCredentialVersionsRepository } from './connections/connections.repository';
import { ConnectionsService } from './connections/connections.service';
import { CredentialVersionsService } from './connections/credential-versions.service';
import { OrganizationToolBindingsRepository, OperationToolBindingsRepository } from './tool-bindings/tool-bindings.repository';
import { ToolBindingsService } from './tool-bindings/tool-bindings.service';
import { WebhookEndpointsRepository, WebhookDeliveriesRepository } from './webhooks/webhooks.repository';
import { WebhooksService } from './webhooks/webhooks.service';

@Module({
  imports: [AuthzModule, AuditModule, IdempotencyModule],
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
  ],
})
export class ConnectorsModule {}
