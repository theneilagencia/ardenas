/**
 * Arden.AS — API v1 · política de avaliação do agente (ARDEN-BE-007.1).
 *
 * Avaliação DETERMINÍSTICA obrigatória. LLM-as-a-judge nunca é o único critério e é
 * `advisoryOnly=true` por default. Nenhum código executável em checks — apenas chaves
 * canônicas + configuração serializável. Pertence à `AgentVersion`.
 */

import { z } from 'zod';
import { agentDeterministicCheckKey } from './agent-keys';
import { modelConfigurationId } from '../common/identifiers';

const outputPath = z.string().min(1).max(200);

export const agentDeterministicCheck = z.object({
  key: agentDeterministicCheckKey,
  configuration: z.record(z.unknown()),
});
export type AgentDeterministicCheck = z.infer<typeof agentDeterministicCheck>;

export const agentEvaluationPolicy = z
  .object({
    requireValidOutputSchema: z.boolean(),
    requireCompletionCriteria: z.boolean(),
    requireEvidenceReferences: z.boolean(),
    forbiddenOutputPaths: z.array(outputPath).max(100),
    requiredOutputPaths: z.array(outputPath).max(100),
    deterministicChecks: z.array(agentDeterministicCheck).max(50),
    llmJudge: z
      .object({
        enabled: z.boolean(),
        modelConfigurationId: modelConfigurationId.nullable().optional(),
        advisoryOnly: z.boolean().default(true),
      })
      .optional(),
  })
  .superRefine((policy, ctx) => {
    // LLM-as-a-judge nunca pode ser o único critério de avaliação.
    if (policy.llmJudge?.enabled && policy.llmJudge.advisoryOnly !== true) {
      const hasDeterministic =
        policy.requireValidOutputSchema ||
        policy.deterministicChecks.length > 0 ||
        policy.requiredOutputPaths.length > 0 ||
        policy.forbiddenOutputPaths.length > 0;
      if (!hasDeterministic) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['llmJudge', 'advisoryOnly'],
          message: 'LLM-as-a-judge não pode ser o único critério: habilite verificações determinísticas.',
        });
      }
    }
  });
export type AgentEvaluationPolicy = z.infer<typeof agentEvaluationPolicy>;

/** Default seguro: só verificação determinística de schema; judge desligado. */
export const AGENT_EVALUATION_POLICY_SAFE_DEFAULT: z.input<typeof agentEvaluationPolicy> = {
  requireValidOutputSchema: true,
  requireCompletionCriteria: false,
  requireEvidenceReferences: false,
  forbiddenOutputPaths: [],
  requiredOutputPaths: [],
  deterministicChecks: [{ key: 'output.schema_valid', configuration: {} }],
};
