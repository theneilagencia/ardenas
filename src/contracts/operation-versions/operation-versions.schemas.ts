/**
 * Arden.AS — API v1 · versões de operação (schemas) (ARDEN-FE-003).
 *
 * IMUTABILIDADE (GAP-06): versão `published` NÃO pode ser alterada — PATCH só
 * aceita `draft`; alteração de publicada retorna `ALREADY_PUBLISHED`. Publicação é
 * comando próprio, com concorrência otimista (`expectedRevision`) e idempotência.
 *
 * `OperationDefinition` mapeia campos JÁ existentes no frontend; campos sem decisão
 * de produto ficam FORA do v1 e marcados como DECISÃO PENDENTE (D-005) na doc.
 */

import { z } from 'zod';
import { isoUtcDateTime } from '../common/timestamps';
import { operationId, operationVersionId, organizationId, userId } from '../common/identifiers';
import { authoritySemanticLevel, authorityProfile } from '../authority/authority.schemas';
import { auditEvent } from '../audit/audit.schemas';
import { operation } from '../operations/operations.schemas';
import { externalActionKey } from '../connectors/connector-keys';

export const operationEnvironment = z.enum(['sandbox', 'staging', 'production']);
export type OperationEnvironment = z.infer<typeof operationEnvironment>;

/**
 * Referência OPCIONAL a uma ferramenta externa vinculada por alias (ARDEN-BE-006.6).
 * Declara que a etapa invoca a ferramenta `alias` com a `actionKey` externa. NÃO
 * carrega segredo, URL nem classe — a resolução tenant-scoped ocorre na execução.
 */
export const operationStepTool = z.object({
  alias: z.string().min(1).max(60),
  actionKey: externalActionKey,
});
export type OperationStepTool = z.infer<typeof operationStepTool>;

/** Passo da operação (espelha `OperationStep` do frontend). */
export const operationStep = z.object({
  id: z.string().min(1),
  order: z.number().int().min(0),
  name: z.string().min(1),
  description: z.string(),
  authorityLevel: authoritySemanticLevel,
  requiresApproval: z.boolean(),
  workUnitCost: z.number().int().min(0),
  producesEvidence: z.boolean(),
  tool: operationStepTool.optional(),
});
export type OperationStep = z.infer<typeof operationStep>;

/** Ação da operação (espelha `OperationAction` do frontend). */
export const operationAction = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  authorityLevel: authoritySemanticLevel,
  destructive: z.boolean(),
});
export type OperationAction = z.infer<typeof operationAction>;

/**
 * Definição da operação na versão. Mapeia campos existentes/necessários ao
 * primeiro marco. Campos como inputs/outputs/rules/exceptionPolicy são DECISÃO
 * PENDENTE (D-005) e NÃO entram no v1.
 */
export const operationDefinition = z.object({
  objective: z.string(),
  expectedResult: z.string(),
  triggers: z.array(z.string()),
  steps: z.array(operationStep),
  actions: z.array(operationAction),
  approverIds: z.array(z.string()),
  contextSourceIds: z.array(z.string()),
  integrationIds: z.array(z.string()),
  completionCriteria: z.array(z.string()),
  environment: operationEnvironment.nullable(),
  evidencePolicy: z.string().nullable(),
});
export type OperationDefinition = z.infer<typeof operationDefinition>;

export const operationVersionStatus = z.enum(['draft', 'published', 'superseded']);
export type OperationVersionStatus = z.infer<typeof operationVersionStatus>;

export const operationVersion = z.object({
  id: operationVersionId,
  operationId,
  organizationId,
  versionNumber: z.number().int().min(1),
  status: operationVersionStatus,
  definition: operationDefinition,
  authorityProfile,
  changeSummary: z.string().max(1000).nullable(),
  createdBy: userId,
  createdAt: isoUtcDateTime,
  updatedAt: isoUtcDateTime,
  publishedBy: userId.nullable(),
  publishedAt: isoUtcDateTime.nullable(),
  revision: z.number().int().min(0),
});
export type OperationVersion = z.infer<typeof operationVersion>;

// ── Requests ──────────────────────────────────────────────────────────────────

/** Cria uma nova versão em rascunho, copiando explicitamente outra quando pedido. */
export const createOperationVersionRequest = z.object({
  basedOnVersionId: z.string().optional(),
  changeSummary: z.string().max(1000).optional(),
});
export type CreateOperationVersionRequest = z.infer<typeof createOperationVersionRequest>;

/** Edita a definição do rascunho. Só rascunho; concorrência via expectedRevision. */
export const updateOperationVersionRequest = z.object({
  definition: operationDefinition.optional(),
  changeSummary: z.string().max(1000).optional(),
  expectedRevision: z.number().int().min(0),
});
export type UpdateOperationVersionRequest = z.infer<typeof updateOperationVersionRequest>;

/** Publicação: comando próprio, revisão esperada e resumo obrigatório. */
export const publishOperationVersionRequest = z.object({
  expectedRevision: z.number().int().min(0),
  changeSummary: z.string().min(1).max(1000),
});
export type PublishOperationVersionRequest = z.infer<typeof publishOperationVersionRequest>;

/** Resposta de publicação: versão publicada + operação atualizada + auditoria. */
export const publishOperationVersionResult = z.object({
  version: operationVersion,
  operation,
  auditEvents: z.array(auditEvent),
});
export type PublishOperationVersionResult = z.infer<typeof publishOperationVersionResult>;

/** Comparação entre versões (diff de alto nível). Granularidade: DECISÃO PENDENTE (D-006). */
export const versionFieldDiff = z.object({
  path: z.string(),
  before: z.unknown().nullable(),
  after: z.unknown().nullable(),
});
export type VersionFieldDiff = z.infer<typeof versionFieldDiff>;

export const versionComparison = z.object({
  base: z.object({ versionId: operationVersionId, versionNumber: z.number().int() }),
  other: z.object({ versionId: operationVersionId, versionNumber: z.number().int() }),
  differences: z.array(versionFieldDiff),
});
export type VersionComparison = z.infer<typeof versionComparison>;
