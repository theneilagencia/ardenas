/**
 * Arden.AS API — avaliação DETERMINÍSTICA mínima (ARDEN-BE-007.3 §18).
 *
 * Somente checks contratados e seguros: schema válido, required/forbidden paths,
 * critérios de conclusão simples e referências de evidência quando exigidas. SEM
 * LLM-as-a-judge: se `llmJudge.enabled=true`, reprova com motivo tipado (nunca ignora).
 * Nenhum código executável em checks.
 */

import { Injectable } from '@nestjs/common';
import type { AgentEvaluationPolicy } from '@arden/contracts';

export interface AgentEvaluationInputV1 {
  policy: AgentEvaluationPolicy;
  acceptedOutput: unknown;
  outputSchemaValid: boolean;
  evidenceReferenceIds: string[];
}

export interface AgentEvaluationResultV1 {
  passed: boolean;
  failedCheckKeys: string[];
  reason?: string;
}

/** Resolve um caminho pontilhado (`a.b.c`) num objeto; `undefined` = ausente. */
function getPath(obj: unknown, path: string): unknown {
  let cur: unknown = obj;
  for (const seg of path.split('.')) {
    if (!cur || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[seg];
  }
  return cur;
}

@Injectable()
export class AgentEvaluatorV1 {
  evaluate(input: AgentEvaluationInputV1): AgentEvaluationResultV1 {
    const failed: string[] = [];
    const { policy } = input;

    // LLM-as-a-judge não é suportado nesta fase — reprova explícito (nunca silencioso).
    if (policy.llmJudge?.enabled) {
      return { passed: false, failedCheckKeys: ['llm_judge'], reason: 'LLM-as-a-judge não suportado nesta fase (007.6+).' };
    }

    if (policy.requireValidOutputSchema && !input.outputSchemaValid) {
      failed.push('output.schema_valid');
    }
    for (const p of policy.requiredOutputPaths) {
      if (getPath(input.acceptedOutput, p) === undefined) failed.push(`output.required:${p}`);
    }
    for (const p of policy.forbiddenOutputPaths) {
      if (getPath(input.acceptedOutput, p) !== undefined) failed.push(`output.forbidden:${p}`);
    }
    if (policy.requireEvidenceReferences && input.evidenceReferenceIds.length === 0) {
      failed.push('output.evidence_referenced');
    }
    // Verificações determinísticas canônicas declaradas (só as seguras nesta fase).
    for (const check of policy.deterministicChecks) {
      if (check.key === 'output.schema_valid' && !input.outputSchemaValid) failed.push(check.key);
      // completion_criteria/required/forbidden/evidence já cobertos acima; checks
      // adicionais canônicos são no-op seguros até 007.6.
    }

    return { passed: failed.length === 0, failedCheckKeys: [...new Set(failed)] };
  }
}
