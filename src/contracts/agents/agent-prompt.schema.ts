/**
 * Arden.AS — API v1 · mensagens do modelo (ARDEN-BE-007.1).
 *
 * Papéis limitados (SYSTEM/USER/ASSISTANT/TOOL). SYSTEM não vem de input externo;
 * TOOL só de execução server-side. Nenhuma mensagem carrega segredo; payloads têm
 * limite; content types explícitos; sem HTML executável; sem anexos nesta fase.
 * Representação INTERNA (não é resposta HTTP administrativa) — sem SDK de provider.
 */

import { z } from 'zod';
import { modelMessageRole, modelMessageContentType } from './agent-keys';

/** Conteúdo de uma mensagem — texto/JSON/resultado de tool, com limite de tamanho. */
export const modelMessageContent = z.object({
  type: modelMessageContentType,
  /** Texto seguro (sem HTML executável). Limite de tamanho por payload. */
  text: z.string().max(200_000).optional(),
  /** Conteúdo estruturado (ex.: TOOL_RESULT/JSON), serializável. */
  data: z.unknown().optional(),
});
export type ModelMessageContent = z.infer<typeof modelMessageContent>;

export const modelMessage = z.object({
  role: modelMessageRole,
  content: z.array(modelMessageContent).min(1).max(50),
  /** Presente apenas em mensagens TOOL: correlaciona com a tool call. */
  toolCallId: z.string().min(1).max(120).optional(),
});
export type ModelMessage = z.infer<typeof modelMessage>;
