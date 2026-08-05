/**
 * Arden.AS API — endpoints do catálogo de conectores (ARDEN-BE-006.8).
 *
 * Catálogo é system-managed (não tenant-scoped), mas exige permissão `connector.view`.
 * Em produção, conectores com `productionAllowed=false` (ex.: internal.test) são
 * OMITIDOS. Sem segredo; leitura pura.
 */

import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { RequirePermission } from '../../authz/decorators';
import { ConnectorDefinitionsRepository, ConnectorToolDefinitionsRepository } from './catalog.repository';
import { toConnectorDefinitionContract, toConnectorToolContract } from '../connectors.serializers';

@Controller('connectors')
export class ConnectorsController {
  constructor(
    private readonly connectors: ConnectorDefinitionsRepository,
    private readonly tools: ConnectorToolDefinitionsRepository,
  ) {}

  private get isProduction(): boolean {
    return (process.env.NODE_ENV ?? 'development') === 'production';
  }

  @Get()
  @RequirePermission('connector.view')
  async list() {
    const rows = await this.connectors.list();
    const visible = rows.filter((c) => c.productionAllowed || !this.isProduction);
    return { data: visible.map(toConnectorDefinitionContract) };
  }

  @Get(':connectorKey')
  @RequirePermission('connector.view')
  async get(@Param('connectorKey') connectorKey: string) {
    const rows = await this.connectors.list();
    const row = rows.find((c) => c.key === connectorKey && (c.productionAllowed || !this.isProduction));
    if (!row) throw new NotFoundException();
    return { data: toConnectorDefinitionContract(row) };
  }

  @Get(':connectorKey/tools')
  @RequirePermission('connector.view')
  async listTools(@Param('connectorKey') connectorKey: string) {
    const rows = await this.connectors.list();
    const connector = rows.find((c) => c.key === connectorKey && (c.productionAllowed || !this.isProduction));
    if (!connector) throw new NotFoundException();
    const tools = await this.tools.listByConnector(connector.id);
    return { data: tools.map(toConnectorToolContract) };
  }
}
