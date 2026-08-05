/**
 * Arden.AS — API v1 · ConnectorToolDefinition (ARDEN-BE-006).
 *
 * Ferramenta TIPADA de um conector. `actionKey` liga ao executor externo (fase
 * futura). Invariantes validadas: timeout positivo, `maximumTimeoutMs >=
 * defaultTimeoutMs`, e ferramenta DESTRUCTIVE/FINANCIAL/SECURITY_CRITICAL não pode
 * declarar `retryMode` inseguro (`SAFE`) por default.
 */

import { z } from 'zod';
import { isoUtcDateTime } from '../common/timestamps';
import { connectorToolDefinitionId } from '../common/identifiers';
import {
  connectorKey,
  connectorVersion,
  toolKey,
  toolVersion,
  externalActionKey,
  connectorToolRiskLevel,
  toolIdempotencyMode,
  toolRetryMode,
  jsonSchemaContract,
} from './connector-keys';

/** Riscos que NÃO podem combinar com retry automático inseguro por default. */
const UNSAFE_RETRY_RISK: ReadonlySet<string> = new Set(['DESTRUCTIVE', 'FINANCIAL', 'SECURITY_CRITICAL']);

const toolDefinitionBase = z.object({
  connectorKey,
  connectorVersion,
  key: toolKey,
  version: toolVersion,
  name: z.string().min(1).max(120),
  description: z.string().max(500).nullable().optional(),
  actionKey: externalActionKey,
  inputSchema: jsonSchemaContract,
  outputSchema: jsonSchemaContract,
  riskLevel: connectorToolRiskLevel,
  idempotencyMode: toolIdempotencyMode,
  retryMode: toolRetryMode,
  defaultTimeoutMs: z.number().int().positive().max(600_000),
  maximumTimeoutMs: z.number().int().positive().max(600_000),
  active: z.boolean(),
});

type ToolBase = z.infer<typeof toolDefinitionBase>;

/** Invariantes de segurança/consistência (aplicadas a ambas as formas). */
function toolInvariants(tool: ToolBase, ctx: z.RefinementCtx): void {
  if (tool.maximumTimeoutMs < tool.defaultTimeoutMs) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['maximumTimeoutMs'],
      message: 'maximumTimeoutMs deve ser >= defaultTimeoutMs.',
    });
  }
  if (UNSAFE_RETRY_RISK.has(tool.riskLevel) && tool.retryMode === 'SAFE') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['retryMode'],
      message: `Ferramenta ${tool.riskLevel} não pode ter retryMode=SAFE por default.`,
    });
  }
}

/** Entidade de catálogo exposta na API (GET /connectors/{key}/tools). */
export const connectorToolDefinition = toolDefinitionBase
  .extend({
    id: connectorToolDefinitionId,
    createdAt: isoUtcDateTime,
    updatedAt: isoUtcDateTime,
  })
  .superRefine(toolInvariants);
export type ConnectorToolDefinition = z.infer<typeof connectorToolDefinition>;

/** Forma CANÔNICA (fonte em código), sem campos gerados pelo banco. */
export const connectorToolDefinitionCanonical = toolDefinitionBase.superRefine(toolInvariants);
export type ConnectorToolDefinitionCanonical = z.infer<typeof connectorToolDefinitionCanonical>;
