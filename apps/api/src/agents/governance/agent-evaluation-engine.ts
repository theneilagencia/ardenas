/**
 * Arden.AS API — motor de avaliação determinística final (ARDEN-BE-007.6 §15–17).
 *
 * PURO. SEM LLM-as-a-judge. Consolida os checks determinísticos a partir dos sinais já
 * apurados pela execução (a avaliação de output/paths ocorre no runtime; aqui refletimos
 * e adicionamos checks de execução: unknown, limites, evidência, sinais críticos,
 * aprovação). Nunca marca PASSED só porque houve output. Nenhum check executa código.
 */

import { Injectable } from '@nestjs/common';
import type { AgentEvaluationSummary, DeterministicEvaluationCheckResult, AgentEvaluationStatusEnum } from '@arden/contracts';

type CheckStatus = 'PASSED' | 'FAILED' | 'SKIPPED';
type Severity = 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';

export interface AgentEvaluationEngineInput {
  reachedEvaluation: boolean;
  outputSchemaValid: boolean | null;
  outputEvaluationPassed: boolean | null;
  requireEvidenceReferences: boolean;
  evidenceReferenceIds: string[];
  turnCount: number; maxTurns: number;
  toolCallCount: number; maxToolCalls: number;
  durationMs: number; maxDurationMs: number;
  criticalSignalCount: number;
  nonCriticalSignalCount: number;
  hadUnknownResult: boolean;
  hadDeniedToolCall: boolean;
  pendingApproval: boolean;
  policyHash: string | null;
}

function check(key: string, status: CheckStatus, severity: Severity, code?: string): DeterministicEvaluationCheckResult {
  return { key, status, severity, code, evidenceReferenceIds: [] };
}

@Injectable()
export class AgentEvaluationEngine {
  evaluate(input: AgentEvaluationEngineInput): AgentEvaluationSummary {
    if (!input.reachedEvaluation) {
      return { status: 'NOT_RUN', policyHash: input.policyHash, checks: [] };
    }
    const checks: DeterministicEvaluationCheckResult[] = [];

    checks.push(check('output.schema_valid',
      input.outputSchemaValid === null ? 'SKIPPED' : input.outputSchemaValid ? 'PASSED' : 'FAILED', 'ERROR'));
    checks.push(check('output.completion_criteria',
      input.outputEvaluationPassed === null ? 'SKIPPED' : input.outputEvaluationPassed ? 'PASSED' : 'FAILED', 'ERROR'));
    checks.push(check('execution.no_unknown_results', input.hadUnknownResult ? 'FAILED' : 'PASSED', 'ERROR'));
    checks.push(check('execution.no_denied_required_action', input.hadDeniedToolCall ? 'FAILED' : 'PASSED', 'WARNING'));
    checks.push(check('execution.within_turn_limit', input.turnCount <= input.maxTurns ? 'PASSED' : 'FAILED', 'ERROR'));
    checks.push(check('execution.within_tool_limit', input.toolCallCount <= input.maxToolCalls ? 'PASSED' : 'FAILED', 'ERROR'));
    checks.push(check('execution.within_duration_limit', input.maxDurationMs > 0 && input.durationMs > input.maxDurationMs ? 'FAILED' : 'PASSED', 'ERROR'));
    checks.push(check('execution.required_evidence_present',
      !input.requireEvidenceReferences ? 'SKIPPED' : input.evidenceReferenceIds.length > 0 ? 'PASSED' : 'FAILED', 'ERROR'));
    checks.push(check('security.no_critical_signal', input.criticalSignalCount === 0 ? 'PASSED' : 'FAILED', 'CRITICAL'));
    checks.push(check('security.no_untrusted_signal', input.nonCriticalSignalCount === 0 ? 'PASSED' : 'FAILED', 'WARNING'));
    checks.push(check('approval.required_actions_approved', input.pendingApproval ? 'FAILED' : 'PASSED', 'ERROR'));

    const mandatoryFailed = checks.some((c) => c.status === 'FAILED' && (c.severity === 'ERROR' || c.severity === 'CRITICAL'));
    const warningFailed = checks.some((c) => c.status === 'FAILED' && c.severity === 'WARNING');
    const status: AgentEvaluationStatusEnum = mandatoryFailed ? 'FAILED' : warningFailed ? 'PARTIAL' : 'PASSED';

    return { status, policyHash: input.policyHash, checks };
  }
}
