/**
 * Arden.AS — API v1 · definição de agente (ARDEN-BE-007.1).
 *
 * Tenant-scoped, versionável e reutilizável. Espelha `OrganizationConnection`:
 * `status` com state machine + `revision` (concorrência otimista) + auditado.
 * `REVOKED` é terminal. Uma definição NUNCA contém API key, segredo, objeto de SDK
 * de provider ou classe executora. `key` é estável por tenant. O agente é executado
 * como etapa de uma operação (`agent.execute`) — nunca por endpoint direto.
 */

import { z } from 'zod';
import { isoUtcDateTime } from '../common/timestamps';
import {
  agentDefinitionId,
  agentVersionId,
  organizationId,
  userId,
} from '../common/identifiers';
import { agentStatus } from './agent-keys';

/** Chave estável do agente por tenant (slug validado). */
export const agentKey = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/, {
    message: 'key deve ser um slug estável (minúsculas, ., _, -).',
  });
export type AgentKey = z.infer<typeof agentKey>;

/** Entidade (resposta). Sem segredo, sem API key, sem SDK object. */
export const agentDefinition = z.object({
  id: agentDefinitionId,
  organizationId,
  key: agentKey,
  name: z.string().min(1).max(120),
  description: z.string().max(500).nullable(),
  status: agentStatus,
  currentPublishedVersionId: agentVersionId.nullable(),
  createdByUserId: userId,
  revision: z.number().int().min(0),
  createdAt: isoUtcDateTime,
  updatedAt: isoUtcDateTime,
});
export type AgentDefinition = z.infer<typeof agentDefinition>;

// ── Requests (tenant no path; sem organizationId no body) ───────────────────────
export const createAgentRequest = z.object({
  key: agentKey,
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
});
export type CreateAgentRequest = z.infer<typeof createAgentRequest>;

/** PATCH edita apenas metadados — NUNCA status (status via comando dedicado). */
export const updateAgentRequest = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(500).nullable().optional(),
  expectedRevision: z.number().int().min(0),
});
export type UpdateAgentRequest = z.infer<typeof updateAgentRequest>;

/** Comando de estado (suspend/reactivate/revoke). Concorrência via expectedRevision. */
export const agentCommandRequest = z.object({
  expectedRevision: z.number().int().min(0),
  reason: z.string().max(400).optional(),
});
export type AgentCommandRequest = z.infer<typeof agentCommandRequest>;

export const listAgentsQuery = z.object({
  status: agentStatus.optional(),
  search: z.string().max(120).optional(),
  modelConfigurationId: z.string().max(128).optional(),
  createdByUserId: z.string().max(128).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});
export type ListAgentsQuery = z.infer<typeof listAgentsQuery>;
