/**
 * Arden.AS — API v1 · ConnectorDefinition (ARDEN-BE-006).
 *
 * Contrato do CATÁLOGO de conectores de sistema (público, não tenant-scoped).
 * `systemManaged` = mantido pelo seed; `productionAllowed=false` marca conectores
 * de teste (INTERNAL_TEST) proibidos em produção. Schemas JSON são documentos
 * serializáveis — nunca `any`, nunca código.
 */

import { z } from 'zod';
import { isoUtcDateTime } from '../common/timestamps';
import { connectorDefinitionId } from '../common/identifiers';
import {
  connectorKey,
  connectorVersion,
  connectorCategory,
  connectorStatus,
  jsonSchemaContract,
} from './connector-keys';
import { connectorNetworkPolicy } from './network-policy.schema';

/** Capacidade declarada do conector (chave estável, não vazia). */
export const connectorCapabilityKey = z.string().min(1).max(64);

/** Entidade de catálogo exposta na API (GET /connectors). */
export const connectorDefinition = z.object({
  id: connectorDefinitionId,
  key: connectorKey,
  version: connectorVersion,
  name: z.string().min(1).max(120),
  description: z.string().max(500).nullable().optional(),
  category: connectorCategory,
  status: connectorStatus,
  systemManaged: z.boolean(),
  productionAllowed: z.boolean(),
  configurationSchema: jsonSchemaContract,
  credentialSchema: jsonSchemaContract,
  networkPolicyTemplate: connectorNetworkPolicy,
  capabilityKeys: z.array(connectorCapabilityKey).max(50),
  createdAt: isoUtcDateTime,
  updatedAt: isoUtcDateTime,
});
export type ConnectorDefinition = z.infer<typeof connectorDefinition>;

/**
 * Forma CANÔNICA (fonte em código), sem campos gerados pelo banco (`id`, datas).
 * É a base da projeção idempotente para o banco (fase futura).
 */
export const connectorDefinitionCanonical = connectorDefinition.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type ConnectorDefinitionCanonical = z.infer<typeof connectorDefinitionCanonical>;
