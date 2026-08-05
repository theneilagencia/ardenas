/**
 * Arden.AS API — projeção PURA do catálogo canônico (ARDEN-BE-006.3 §8).
 *
 * Função reutilizada pelo SEED (PrismaClient standalone) e pelo projector Nest (via
 * transação). Idempotente: cria ausentes, atualiza só campos system-managed quando o
 * `catalogHash` muda, marca removidos como DEPRECATED/inativos — sem apagar histórico
 * e sem tocar dados tenant-scoped. Opera diretamente no client (PrismaClient ou tx).
 */

import {
  projectConnectorCatalog,
  type ConnectorDefinitionCanonical,
  type ConnectorToolDefinitionCanonical,
} from '@arden/contracts';
import { stableHash } from './connector-catalog.hash';

/** Subconjunto do PrismaClient necessário à projeção (também satisfeito por tx). */
export interface CatalogDbClient {
  connectorDefinition: {
    findFirst(args: unknown): Promise<{ id: string; catalogHash: string; status: string } | null>;
    findMany(args: unknown): Promise<Array<{ id: string; key: string; version: string; status: string; systemManaged: boolean }>>;
    create(args: unknown): Promise<{ id: string }>;
    update(args: unknown): Promise<{ id: string }>;
  };
  connectorToolDefinition: {
    findFirst(args: unknown): Promise<{ id: string; catalogHash: string; active: boolean } | null>;
    findMany(args: unknown): Promise<Array<{ id: string; key: string; version: string; active: boolean }>>;
    create(args: unknown): Promise<{ id: string }>;
    update(args: unknown): Promise<{ id: string }>;
  };
}

export interface ConnectorCatalogProjectionResult {
  connectorsCreated: number;
  connectorsUpdated: number;
  connectorsUnchanged: number;
  connectorsDeprecated: number;
  toolsCreated: number;
  toolsUpdated: number;
  toolsUnchanged: number;
  toolsDisabled: number;
}

function defData(def: ConnectorDefinitionCanonical) {
  return {
    key: def.key, version: def.version, name: def.name, description: def.description ?? null,
    category: def.category, status: 'ACTIVE', systemManaged: def.systemManaged, productionAllowed: def.productionAllowed,
    configurationSchema: def.configurationSchema, credentialSchema: def.credentialSchema,
    networkPolicyTemplate: def.networkPolicyTemplate, capabilityKeys: def.capabilityKeys, catalogHash: stableHash(def),
  };
}

function toolData(tool: ConnectorToolDefinitionCanonical, connectorDefinitionId: string) {
  return {
    connectorDefinitionId, key: tool.key, version: tool.version, name: tool.name, description: tool.description ?? null,
    actionKey: tool.actionKey, inputSchema: tool.inputSchema, outputSchema: tool.outputSchema, riskLevel: tool.riskLevel,
    idempotencyMode: tool.idempotencyMode, retryMode: tool.retryMode, defaultTimeoutMs: tool.defaultTimeoutMs,
    maximumTimeoutMs: tool.maximumTimeoutMs, active: tool.active, catalogHash: stableHash(tool),
  };
}

export async function runCatalogProjection(db: CatalogDbClient): Promise<ConnectorCatalogProjectionResult> {
  const { definitions, tools } = projectConnectorCatalog();
  const result: ConnectorCatalogProjectionResult = {
    connectorsCreated: 0, connectorsUpdated: 0, connectorsUnchanged: 0, connectorsDeprecated: 0,
    toolsCreated: 0, toolsUpdated: 0, toolsUnchanged: 0, toolsDisabled: 0,
  };

  const canonicalDefKeys = new Set(definitions.map((d) => `${d.key}@${d.version}`));
  const idByKey = new Map<string, string>();

  for (const def of definitions) {
    const data = defData(def);
    const existing = await db.connectorDefinition.findFirst({ where: { key: def.key, version: def.version } });
    if (!existing) {
      const created = await db.connectorDefinition.create({ data });
      idByKey.set(`${def.key}@${def.version}`, created.id);
      result.connectorsCreated++;
    } else if (existing.catalogHash === data.catalogHash && existing.status === 'ACTIVE') {
      idByKey.set(`${def.key}@${def.version}`, existing.id);
      result.connectorsUnchanged++;
    } else {
      await db.connectorDefinition.update({ where: { id: existing.id }, data });
      idByKey.set(`${def.key}@${def.version}`, existing.id);
      result.connectorsUpdated++;
    }
  }

  // Definições system-managed removidas do canônico → DEPRECATED (não apagadas).
  for (const existing of await db.connectorDefinition.findMany({ orderBy: { key: 'asc' } })) {
    if (existing.systemManaged && !canonicalDefKeys.has(`${existing.key}@${existing.version}`) && existing.status === 'ACTIVE') {
      await db.connectorDefinition.update({ where: { id: existing.id }, data: { status: 'DEPRECATED' } });
      result.connectorsDeprecated++;
    }
  }

  const canonicalToolKeys = new Set<string>();
  for (const tool of tools) {
    const connectorDefinitionId = idByKey.get(`${tool.connectorKey}@${tool.connectorVersion}`);
    if (!connectorDefinitionId) continue;
    canonicalToolKeys.add(`${connectorDefinitionId}::${tool.key}@${tool.version}`);
    const data = toolData(tool, connectorDefinitionId);
    const existing = await db.connectorToolDefinition.findFirst({ where: { connectorDefinitionId, key: tool.key, version: tool.version } });
    if (!existing) {
      await db.connectorToolDefinition.create({ data });
      result.toolsCreated++;
    } else if (existing.catalogHash === data.catalogHash && existing.active === tool.active) {
      result.toolsUnchanged++;
    } else {
      await db.connectorToolDefinition.update({ where: { id: existing.id }, data });
      result.toolsUpdated++;
    }
  }

  // Ferramentas removidas do canônico → desabilitadas (não apagadas).
  for (const id of idByKey.values()) {
    for (const existing of await db.connectorToolDefinition.findMany({ where: { connectorDefinitionId: id }, orderBy: { key: 'asc' } })) {
      if (existing.active && !canonicalToolKeys.has(`${id}::${existing.key}@${existing.version}`)) {
        await db.connectorToolDefinition.update({ where: { id: existing.id }, data: { active: false } });
        result.toolsDisabled++;
      }
    }
  }

  return result;
}
