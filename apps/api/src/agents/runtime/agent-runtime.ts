/**
 * Arden.AS API — runtime de agentes DETERMINÍSTICO (ARDEN-BE-007.3 §14).
 *
 * Orquestra: resolver → validar input → montar contexto → limites → provider →
 * classificar → validar structured output → repair limitado → avaliação determinística →
 * usage → resultado + evidência/auditoria SANITIZADAS. PURO em relação ao motor: não
 * grava nada — devolve `AgentRuntimeOutcome` para o `AgentStepExecutor` persistir.
 * Sem SDK, sem internet, sem segredo, sem tool calling.
 */

import { Injectable } from '@nestjs/common';
import { zeroAgentUsage, agentExecutionResultInvariants, type AgentExecutionResult, type AgentUsage, type ModelGenerationRequest, type ModelGenerationResult, type ModelMessage, type AgentSecuritySignal } from '@arden/contracts';
import { validateAgainstSchema } from '../../connectors/tools/json-schema-validator';
import { stableHash } from '../hashing/stable-hash';
import { AgentRuntimeResolverService } from './agent-runtime-resolver';
import { InMemoryModelProviderRegistry } from './model-provider-registry';
import { AgentContextAssemblerV1 } from './agent-context-assembler';
import { AgentOutputValidatorV1 } from './agent-output-validator';
import { AgentEvaluatorV1 } from './agent-evaluator';
import { REPAIR_MARKER } from './internal-test-model.provider';
import { ModelProviderInvocationError } from './model-provider.errors';
import type { AgentRuntime, AgentRuntimeExecutionInput, AgentRuntimeOutcome, AgentLifecycleEvent, ResolvedAgentRuntime } from './agent-runtime.types';

function addUsage(a: AgentUsage, b: ModelGenerationResult['usage']): AgentUsage {
  return {
    ...a,
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    cachedInputTokens: (a.cachedInputTokens ?? 0) + (b.cachedInputTokens ?? 0),
    cachedOutputTokens: (a.cachedOutputTokens ?? 0) + (b.cachedOutputTokens ?? 0),
    modelCallCount: a.modelCallCount + b.modelCallCount,
    durationMs: a.durationMs + b.durationMs,
  };
}

@Injectable()
export class AgentRuntimeService implements AgentRuntime {
  constructor(
    private readonly resolver: AgentRuntimeResolverService,
    private readonly registry: InMemoryModelProviderRegistry,
    private readonly assembler: AgentContextAssemblerV1,
    private readonly validator: AgentOutputValidatorV1,
    private readonly evaluator: AgentEvaluatorV1,
  ) {}

  async execute(input: AgentRuntimeExecutionInput): Promise<AgentRuntimeOutcome> {
    const events: AgentLifecycleEvent[] = [];
    const push = (eventType: string, payload: Record<string, unknown> = {}): void => {
      events.push({ eventType, payload });
    };
    push('agent.execution_started', { agentVersionId: input.agentVersionId, attempt: input.attemptNumber });

    let resolved: ResolvedAgentRuntime;
    try {
      resolved = await this.resolver.resolveForExecution({
        organizationId: input.organizationId,
        operationId: input.operationId,
        operationVersionId: input.operationVersionId,
        agentDefinitionId: input.agentDefinitionId,
        agentVersionId: input.agentVersionId,
      });
    } catch (err) {
      // Falha de resolução (tenant/estado/provider/ambiente) → resultado tipado, sem contexto.
      const code = err && typeof err === 'object' && 'code' in err ? String((err as { code: unknown }).code) : 'INTERNAL_ERROR';
      const message = err instanceof Error ? err.message : 'Falha na resolução do agente.';
      push('agent.execution_failed', { code });
      const usage = zeroAgentUsage('unknown', 'unknown');
      return {
        result: { status: 'FAILED', errorCode: code, errorSummary: message, usage, modelCallCount: 0, toolCallCount: 0, turnCount: 0, evidenceReferenceIds: [], durationMs: 0 },
        retryable: false,
        evidence: { agentDefinitionId: input.agentDefinitionId, agentVersionId: input.agentVersionId, status: 'FAILED', errorCode: code },
        events,
        audit: [
          { action: 'agent.execution_started', outcome: 'SUCCESS', metadata: { agentVersionId: input.agentVersionId } },
          { action: 'agent.execution_failed', outcome: 'FAILURE', metadata: { errorCode: code } },
        ],
      };
    }

    let usage = zeroAgentUsage(resolved.providerKey, resolved.modelId);
    const base = { resolved, events, push, input } as const;

    // Tool calling não é suportado nesta fase (§11).
    if (resolved.executionPolicy.toolCallingAllowed || resolved.executionPolicy.maximumToolCalls > 0) {
      return this.fail(base, usage, 'FAILED', 'AGENT_TOOL_NOT_ALLOWED', 'Tool calling ainda não suportado (007.5).', false, [], null);
    }

    // §7.19 + §16: valida input contra inputSchema.
    const inputViolations = validateAgainstSchema(input.input, resolved.inputSchema);
    if (inputViolations.length > 0) {
      return this.fail(base, usage, 'FAILED', 'AGENT_INPUT_INVALID', 'Entrada não valida contra inputSchema.', false, [], null);
    }

    // §12: contexto mínimo v1.
    const context = this.assembler.assemble({
      organizationId: input.organizationId,
      contextPolicy: resolved.contextPolicy,
      objective: resolved.objective,
      systemInstructions: resolved.systemInstructions,
      executionInput: input.input,
      correlationId: input.correlationId,
    });
    push('agent.context_assembled', { contextBytes: context.contextBytes, estimatedInputTokens: context.estimatedInputTokens, signals: context.securitySignals.length });

    // §31: bloqueio determinístico de sinais CRITICAL explícitos.
    const blocked = context.securitySignals.find((s) => s.blocked);
    if (blocked) {
      return this.fail(base, usage, 'FAILED', 'AGENT_PROMPT_INJECTION_DETECTED', 'Sinal de injeção bloqueado.', false, context.securitySignals, null);
    }

    // §12/§20: limites de contexto e tokens.
    if (context.contextBytes > resolved.contextPolicy.maximumContextBytes) {
      return this.fail(base, usage, 'FAILED', 'AGENT_CONTEXT_TOO_LARGE', 'Contexto excede maximumContextBytes.', false, context.securitySignals, null);
    }
    const inputTokenCeiling = Math.min(resolved.executionPolicy.maximumInputTokens, resolved.contextPolicy.maximumInputTokens);
    if (context.estimatedInputTokens > inputTokenCeiling) {
      return this.fail(base, usage, 'FAILED', 'AGENT_TOKEN_LIMIT_EXCEEDED', 'Contexto excede maximumInputTokens.', false, context.securitySignals, null);
    }

    const provider = this.registry.get(resolved.providerKey, resolved.providerVersion);
    const messages: ModelMessage[] = [...context.messages];
    const maxRepairs = resolved.executionPolicy.retryInvalidOutput ? resolved.executionPolicy.maximumOutputRepairAttempts : 0;

    let repairAttemptCount = 0;
    let lastValidationErrors: { path: string; code: string; message: string }[] | undefined;

    for (let call = 0; ; call++) {
      const request: ModelGenerationRequest = {
        providerKey: resolved.providerKey,
        providerVersion: resolved.providerVersion,
        modelId: resolved.modelId,
        systemInstructions: resolved.systemInstructions,
        messages,
        tools: [],
        outputSchema: resolved.outputSchema,
        maximumInputTokens: resolved.executionPolicy.maximumInputTokens,
        maximumOutputTokens: resolved.executionPolicy.maximumOutputTokens,
        correlationId: input.correlationId,
      };
      push('agent.model_called', { modelId: resolved.modelId, call: call + 1 });

      let result: ModelGenerationResult;
      try {
        result = await provider.generate(request);
      } catch (err) {
        return this.handleProviderError(base, usage, err, context.securitySignals);
      }
      usage = addUsage(usage, result.usage);
      push('agent.output_received', { finishReason: result.finishReason });

      if (result.finishReason === 'CONTENT_FILTER') {
        return this.fail(base, usage, 'FAILED', 'MODEL_CONTENT_FILTERED', 'Conteúdo bloqueado pelo filtro do provider.', false, context.securitySignals, null);
      }

      const validation = this.validator.validate({
        schema: resolved.outputSchema,
        rawOutput: result.structuredOutput,
        maximumOutputBytes: resolved.executionPolicy.maximumOutputTokens * 4,
        repairAttemptCount,
      });

      if (validation.valid) {
        // Avaliação determinística.
        const evaluation = this.evaluator.evaluate({
          policy: resolved.evaluationPolicy,
          acceptedOutput: validation.acceptedOutput,
          outputSchemaValid: true,
          evidenceReferenceIds: [],
        });
        if (!evaluation.passed) {
          push('agent.evaluation_failed', { failedChecks: evaluation.failedCheckKeys });
          return this.fail(base, usage, 'FAILED', 'AGENT_EVALUATION_FAILED', evaluation.reason ?? 'Avaliação reprovou.', false, context.securitySignals, null, { repairAttemptCount, evaluation });
        }
        push('agent.evaluation_passed', {});
        return this.succeed(base, usage, validation.acceptedOutput, context.securitySignals, repairAttemptCount, evaluation.failedCheckKeys);
      }

      // Output inválido.
      lastValidationErrors = validation.validationErrors;
      push('agent.output_invalid', { errors: (validation.validationErrors ?? []).length, repairAttemptCount });
      if (repairAttemptCount < maxRepairs) {
        repairAttemptCount++;
        push('agent.output_repair_started', { attempt: repairAttemptCount });
        messages.push({
          role: 'USER',
          content: [{ type: 'TEXT', text: `${REPAIR_MARKER} corrija a saída para satisfazer o schema. Erros: ${JSON.stringify(validation.validationErrors ?? [])}` }],
        });
        continue;
      }

      // Sem repair possível.
      if (maxRepairs > 0) {
        push('agent.output_repair_exhausted', { repairAttemptCount });
        return this.fail(base, usage, 'FAILED', 'AGENT_OUTPUT_REPAIR_EXHAUSTED', 'Tentativas de correção esgotadas.', false, context.securitySignals, null, { repairAttemptCount, validationErrors: lastValidationErrors });
      }
      return this.fail(base, usage, 'FAILED', 'AGENT_OUTPUT_INVALID', 'Saída não valida contra outputSchema.', false, context.securitySignals, null, { repairAttemptCount, validationErrors: lastValidationErrors });
    }
  }

  // ── Construção de resultado ─────────────────────────────────────────────────
  private handleProviderError(
    base: RuntimeBase,
    usage: AgentUsage,
    err: unknown,
    signals: AgentSecuritySignal[],
  ): AgentRuntimeOutcome {
    const policy = base.resolved.executionPolicy;
    if (err instanceof ModelProviderInvocationError) {
      switch (err.kind) {
        case 'TIMEOUT':
          return this.fail(base, usage, policy.timeoutBehavior === 'SUSPEND' ? 'SUSPENDED' : 'FAILED', 'AGENT_TIMEOUT', 'Tempo limite do agente.', true, signals, null);
        case 'RATE_LIMIT':
          return this.fail(base, usage, 'FAILED', 'MODEL_RATE_LIMITED', 'Provider limitou a taxa.', true, signals, null);
        case 'UNKNOWN':
          return this.fail(base, usage, policy.unknownResultBehavior === 'SUSPEND' ? 'SUSPENDED' : 'UNKNOWN', 'MODEL_RESULT_UNKNOWN', 'Resultado do modelo indeterminado.', false, signals, null);
        case 'PROVIDER_ERROR':
        case 'UNSUPPORTED_MODEL':
        default:
          return this.fail(base, usage, 'FAILED', 'MODEL_PROVIDER_ERROR', 'Erro do provider de modelo.', true, signals, null);
      }
    }
    return this.fail(base, usage, 'FAILED', 'MODEL_PROVIDER_ERROR', 'Erro do provider de modelo.', true, signals, null);
  }

  private succeed(
    base: RuntimeBase,
    usage: AgentUsage,
    output: unknown,
    signals: AgentSecuritySignal[],
    repairAttemptCount: number,
    evaluationFailed: string[],
  ): AgentRuntimeOutcome {
    const result: AgentExecutionResult = {
      status: 'SUCCEEDED', output,
      usage, modelCallCount: usage.modelCallCount, toolCallCount: 0, turnCount: 1,
      evidenceReferenceIds: [], durationMs: usage.durationMs,
    };
    return this.finalize(base, result, true, signals, repairAttemptCount, output, evaluationFailed);
  }

  private fail(
    base: RuntimeBase,
    usage: AgentUsage,
    status: AgentExecutionResult['status'],
    errorCode: string,
    errorSummary: string,
    retryable: boolean,
    signals: AgentSecuritySignal[],
    output: unknown,
    extra: Record<string, unknown> = {},
  ): AgentRuntimeOutcome {
    const result: AgentExecutionResult = {
      status, errorCode, errorSummary,
      usage, modelCallCount: usage.modelCallCount, toolCallCount: 0, turnCount: usage.modelCallCount > 0 ? 1 : 0,
      evidenceReferenceIds: [], durationMs: usage.durationMs,
    };
    return this.finalize(base, result, retryable, signals, (extra.repairAttemptCount as number) ?? 0, output ?? null, [], extra);
  }

  private finalize(
    base: RuntimeBase,
    result: AgentExecutionResult,
    retryable: boolean,
    signals: AgentSecuritySignal[],
    repairAttemptCount: number,
    output: unknown,
    evaluationFailed: string[],
    extra: Record<string, unknown> = {},
  ): AgentRuntimeOutcome {
    // Invariantes: SUCCEEDED exige output; FAILED exige erro; UNKNOWN não é sucesso.
    const problems = agentExecutionResultInvariants(result);
    const safeResult = problems.length === 0 ? result : { ...result, status: 'FAILED' as const, errorCode: result.errorCode ?? 'INTERNAL_ERROR', errorSummary: 'Resultado inconsistente.' };

    const { resolved } = base;
    const evidence: Record<string, unknown> = {
      agentDefinitionId: resolved.agentDefinitionId,
      agentVersionId: resolved.agentVersionId,
      agentKey: resolved.agentKey,
      versionNumber: resolved.versionNumber,
      contentHash: resolved.contentHash,
      providerKey: resolved.providerKey,
      providerVersion: resolved.providerVersion,
      modelId: resolved.modelId,
      inputHash: stableHash(base.input.input ?? null),
      outputHash: safeResult.status === 'SUCCEEDED' ? stableHash(output ?? null) : null,
      schemaHash: stableHash(resolved.outputSchema),
      status: safeResult.status,
      errorCode: safeResult.errorCode ?? null,
      repairAttemptCount,
      modelCallCount: safeResult.modelCallCount,
      toolCallCount: 0,
      turnCount: safeResult.turnCount,
      usage: safeResult.usage,
      durationMs: safeResult.durationMs,
      securitySignals: signals,
      evaluationFailedChecks: evaluationFailed,
      ...extra,
    };

    const finalAction =
      safeResult.status === 'SUCCEEDED' ? 'agent.execution_completed'
      : safeResult.status === 'UNKNOWN' || safeResult.status === 'SUSPENDED' ? 'agent.execution_unknown'
      : 'agent.execution_failed';
    base.push(finalAction, { status: safeResult.status, errorCode: safeResult.errorCode ?? null, modelCallCount: safeResult.modelCallCount, repairAttemptCount });

    return {
      result: safeResult,
      retryable: safeResult.status === 'SUCCEEDED' ? false : retryable,
      evidence,
      events: base.events,
      audit: [
        { action: 'agent.execution_started', outcome: 'SUCCESS', metadata: { agentVersionId: resolved.agentVersionId, contentHash: resolved.contentHash, providerKey: resolved.providerKey, modelId: resolved.modelId } },
        { action: finalAction, outcome: safeResult.status === 'SUCCEEDED' ? 'SUCCESS' : 'FAILURE', metadata: { status: safeResult.status, errorCode: safeResult.errorCode ?? null, modelCallCount: safeResult.modelCallCount, repairAttemptCount, usage: safeResult.usage } },
      ],
    };
  }
}

interface RuntimeBase {
  resolved: ResolvedAgentRuntime;
  events: AgentLifecycleEvent[];
  push: (eventType: string, payload?: Record<string, unknown>) => void;
  input: AgentRuntimeExecutionInput;
}
