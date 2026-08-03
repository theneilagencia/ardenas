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
import { AgentContextAssemblerV2 } from './context/agent-context-assembler-v2';
import type { AgentContextAssemblyResult } from './context/agent-context.types';
import { AgentOutputValidatorV1 } from './agent-output-validator';
import { AgentEvaluatorV1 } from './agent-evaluator';
import { REPAIR_MARKER } from './internal-test-model.provider';
import { ModelProviderInvocationError } from './model-provider.errors';
import { ApiException } from '../../common/errors/api-error';
import { AgentToolBindingResolver } from './tools/agent-tool-binding-resolver';
import { AgentToolCallValidator } from './tools/agent-tool-call-validator';
import { AgentToolAuthorityEvaluator } from './tools/agent-tool-authority-evaluator';
import { AgentToolExecutor } from './tools/agent-tool-executor';
import { AgentToolApprovalService } from './tools/agent-tool-approval.service';
import { AgentRuntimeCheckpointRepository, type CompletedToolCallMap } from './tools/agent-runtime-checkpoint.repository';
import type { ResolvedAgentToolDefinition, AgentToolCallHistoryEntry } from './tools/agent-tool.types';
import type { AgentRuntime, AgentRuntimeExecutionInput, AgentRuntimeOutcome, AgentLifecycleEvent, ResolvedAgentRuntime, AgentModelCallRecord, AgentToolCallRecord } from './agent-runtime.types';

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
    private readonly assembler: AgentContextAssemblerV2,
    private readonly validator: AgentOutputValidatorV1,
    private readonly evaluator: AgentEvaluatorV1,
    private readonly toolResolver: AgentToolBindingResolver,
    private readonly toolValidator: AgentToolCallValidator,
    private readonly toolAuthority: AgentToolAuthorityEvaluator,
    private readonly toolExecutor: AgentToolExecutor,
    private readonly toolApproval: AgentToolApprovalService,
    private readonly checkpoints: AgentRuntimeCheckpointRepository,
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
        modelCalls: [],
        toolCalls: [],
      };
    }

    let usage = zeroAgentUsage(resolved.providerKey, resolved.modelId);
    const base: RuntimeBase = { resolved, events, push, input, modelCalls: [], toolCalls: [] };

    // §7.19 + §16: valida input contra inputSchema.
    const inputViolations = validateAgainstSchema(input.input, resolved.inputSchema);
    if (inputViolations.length > 0) {
      return this.fail(base, usage, 'FAILED', 'AGENT_INPUT_INVALID', 'Entrada não valida contra inputSchema.', false, [], null);
    }

    // §12-§17: montagem de contexto v2 (fontes tenant-scoped + guardrails + orçamento).
    let context: AgentContextAssemblyResult;
    try {
      context = await this.assembler.assemble({
        organizationId: input.organizationId,
        operationId: input.operationId,
        operationVersionId: input.operationVersionId,
        executionRunId: input.executionRunId,
        executionStepId: input.executionStepId,
        contextPolicy: resolved.contextPolicy,
        objective: resolved.objective,
        systemInstructions: resolved.systemInstructions,
        executionInput: input.input,
        correlationId: input.correlationId,
      });
    } catch (err) {
      // Violação dura de fonte (tenant/autorização) → resultado tipado sanitizado.
      const code = err instanceof ApiException ? err.code : 'AGENT_CONTEXT_SOURCE_NOT_ALLOWED';
      const message = err instanceof Error ? err.message : 'Fonte de contexto não autorizada.';
      return this.fail(base, usage, 'FAILED', code, message, false, [], null);
    }
    base.context = context;

    // Trilha de contexto (por fonte, sinais, exclusões) — sanitizada.
    this.emitContextEvents(push, context);

    // §17/§31: desfechos terminais da montagem (isolamento não bloqueia; injeção crítica sim).
    if (context.outcome === 'BLOCKED') {
      push('agent.context_blocked', { signals: context.securitySignals.length });
      return this.fail(base, usage, 'FAILED', 'AGENT_PROMPT_INJECTION_DETECTED', 'Sinal de injeção crítico bloqueado.', false, context.securitySignals, null);
    }
    if (context.outcome === 'BUDGET_EXCEEDED') {
      push('agent.context_budget_exceeded', {});
      return this.fail(base, usage, 'FAILED', 'AGENT_CONTEXT_BUDGET_EXCEEDED', 'Orçamento de contexto insuficiente.', false, context.securitySignals, null);
    }
    if (context.outcome === 'SOURCE_INVALID') {
      return this.fail(base, usage, 'FAILED', 'AGENT_CONTEXT_SOURCE_INVALID', 'Fonte de contexto obrigatória inválida.', false, context.securitySignals, null);
    }
    push('agent.context_assembled', { totalBytes: context.totalBytes, estimatedInputTokens: context.estimatedInputTokens, includedSources: context.includedSources.length, excludedSources: context.excludedSources.length, truncated: context.truncated, signals: context.securitySignals.length, contextHash: context.contextHash });

    // §12/§20: limites de contexto e tokens.
    if (context.totalBytes > resolved.contextPolicy.maximumContextBytes) {
      return this.fail(base, usage, 'FAILED', 'AGENT_CONTEXT_TOO_LARGE', 'Contexto excede maximumContextBytes.', false, context.securitySignals, null);
    }
    const inputTokenCeiling = Math.min(resolved.executionPolicy.maximumInputTokens, resolved.contextPolicy.maximumInputTokens);
    if (context.estimatedInputTokens > inputTokenCeiling) {
      return this.fail(base, usage, 'FAILED', 'AGENT_TOKEN_LIMIT_EXCEEDED', 'Contexto excede maximumInputTokens.', false, context.securitySignals, null);
    }

    const provider = this.registry.get(resolved.providerKey, resolved.providerVersion);
    const messages: ModelMessage[] = [...context.messages];
    const maxRepairs = resolved.executionPolicy.retryInvalidOutput ? resolved.executionPolicy.maximumOutputRepairAttempts : 0;
    const toolCallingAllowed = resolved.executionPolicy.toolCallingAllowed;

    // §7: ferramentas efetivamente disponíveis (interseção completa; superfície mínima).
    let tools: ResolvedAgentToolDefinition[] = [];
    if (toolCallingAllowed) {
      tools = await this.toolResolver.resolveAllowedTools({
        organizationId: input.organizationId, operationId: input.operationId, operationVersionId: input.operationVersionId,
        correlationId: input.correlationId, allowedAliases: resolved.toolPolicy.allowedAliases,
      });
      push('agent.tool_definitions_resolved', { count: tools.length, aliases: tools.map((t) => t.alias) });
      await this.checkpoints.ensure({ organizationId: input.organizationId, executionRunId: input.executionRunId, executionStepId: input.executionStepId, agentDefinitionId: resolved.agentDefinitionId, agentVersionId: resolved.agentVersionId });
    }
    const modelTools = tools.map((t) => ({ alias: t.alias, description: t.description, inputSchema: t.inputSchema, riskLevel: t.riskLevel }));
    const cp = toolCallingAllowed ? await this.checkpoints.findByStep(input.organizationId, input.executionStepId) : null;
    const completed: CompletedToolCallMap = ((cp?.completedToolCalls as CompletedToolCallMap | null) ?? {}) as CompletedToolCallMap;

    const toolHistory: AgentToolCallHistoryEntry[] = [];
    let toolCallCount = cp?.toolCallCount ?? 0;
    let turnCount = 0;
    let repairAttemptCount = 0;
    let modelCallPurpose: AgentModelCallRecord['purpose'] = 'PRIMARY';
    let lastValidationErrors: { path: string; code: string; message: string }[] | undefined;

    for (;;) {
      const request: ModelGenerationRequest = {
        providerKey: resolved.providerKey, providerVersion: resolved.providerVersion, modelId: resolved.modelId,
        systemInstructions: resolved.systemInstructions, messages, tools: modelTools, outputSchema: resolved.outputSchema,
        maximumInputTokens: resolved.executionPolicy.maximumInputTokens, maximumOutputTokens: resolved.executionPolicy.maximumOutputTokens,
        correlationId: input.correlationId,
      };
      push('agent.model_called', { modelId: resolved.modelId, turn: turnCount });

      let result: ModelGenerationResult;
      try {
        result = await provider.generate(request);
      } catch (err) {
        base.modelCalls.push({ callIndex: base.modelCalls.length, purpose: modelCallPurpose, status: 'FAILED', finishReason: null, inputTokens: 0, outputTokens: 0, cachedInputTokens: 0, cachedOutputTokens: 0, durationMs: 0, requestHash: null, responseHash: null });
        return this.handleProviderError(base, usage, err, context.securitySignals);
      }
      usage = addUsage(usage, result.usage);
      base.modelCalls.push({ callIndex: base.modelCalls.length, purpose: modelCallPurpose, status: 'SUCCEEDED', finishReason: result.finishReason, inputTokens: result.usage.inputTokens, outputTokens: result.usage.outputTokens, cachedInputTokens: result.usage.cachedInputTokens ?? 0, cachedOutputTokens: result.usage.cachedOutputTokens ?? 0, durationMs: result.usage.durationMs, requestHash: null, responseHash: null });
      modelCallPurpose = 'PRIMARY';
      push('agent.output_received', { finishReason: result.finishReason });

      if (result.finishReason === 'CONTENT_FILTER') {
        return this.fail(base, usage, 'FAILED', 'MODEL_CONTENT_FILTERED', 'Conteúdo bloqueado pelo filtro do provider.', false, context.securitySignals, null);
      }

      // ── Ramo de TOOL CALL (o modelo propõe; o servidor decide/executa) ───────────
      if (result.finishReason === 'TOOL_CALL' && result.toolCalls.length > 0) {
        if (!toolCallingAllowed) {
          return this.fail(base, usage, 'FAILED', 'AGENT_TOOL_NOT_ALLOWED', 'Tool calling não permitido pela política.', false, context.securitySignals, null);
        }
        const step = await this.processToolCall({ base, resolved, tools, toolCall: result.toolCalls[0], toolHistory, completed, toolCallCount });
        if (step.kind === 'FAIL') {
          return this.fail(base, usage, 'FAILED', step.code, step.summary, false, context.securitySignals, null, { toolCallCount });
        }
        if (step.kind === 'UNKNOWN') {
          const status = resolved.executionPolicy.unknownResultBehavior === 'SUSPEND' ? 'SUSPENDED' : 'UNKNOWN';
          return this.fail(base, usage, status, 'MODEL_RESULT_UNKNOWN', 'Resultado de tool incerto.', false, context.securitySignals, null, { toolCallCount });
        }
        if (step.kind === 'SUSPEND') {
          await this.checkpoints.markSuspended(input.executionStepId, step.pending, step.approvalRequestId, { turnCount, modelCallCount: usage.modelCallCount, toolCallCount }, context.contextHash);
          return this.suspend(base, usage, context.securitySignals, step.approvalRequestId, step.pending.alias, { turnCount, toolCallCount });
        }
        // CONTINUE: um novo turno (rodada de tool). Aplica o teto de turnos.
        turnCount++;
        if (turnCount > resolved.executionPolicy.maximumTurns) {
          return this.fail(base, usage, 'FAILED', 'AGENT_TURN_LIMIT_EXCEEDED', 'Limite de turnos atingido.', false, context.securitySignals, null, { toolCallCount });
        }
        toolCallCount++;
        toolHistory.push({ alias: step.alias, toolCallId: step.toolCallId, status: step.status, inputHash: step.inputHash });
        completed[step.idempotencyKey] = { alias: step.alias, actionKey: step.actionKey, status: step.status, outputHash: step.outputHash, evidenceReferenceId: step.evidenceReferenceId, errorCode: step.errorCode };
        base.toolCalls.push({ toolCallId: step.toolCallId, alias: step.alias, actionKey: step.actionKey, riskLevel: step.riskLevel, decision: step.decision, status: step.status, authorizationId: step.authorizationId ?? null, approvalRequestId: null, inputHash: step.inputHash, outputHash: step.outputHash ?? null, durationMs: 0, retryCount: 0 });
        if (!step.replayed) {
          await this.checkpoints.recordCompleted(input.executionStepId, step.idempotencyKey, { alias: step.alias, actionKey: step.actionKey, status: step.status, outputHash: step.outputHash, evidenceReferenceId: step.evidenceReferenceId, errorCode: step.errorCode }, { turnCount, modelCallCount: usage.modelCallCount, toolCallCount });
        }
        messages.push(step.message);
        modelCallPurpose = 'TOOL_CONTINUATION';
        continue;
      }

      // ── Ramo de OUTPUT FINAL (validação + repair + avaliação) ────────────────────
      const validation = this.validator.validate({
        schema: resolved.outputSchema, rawOutput: result.structuredOutput,
        maximumOutputBytes: resolved.executionPolicy.maximumOutputTokens * 4, repairAttemptCount,
      });

      if (validation.valid) {
        const evaluation = this.evaluator.evaluate({ policy: resolved.evaluationPolicy, acceptedOutput: validation.acceptedOutput, outputSchemaValid: true, evidenceReferenceIds: [] });
        if (!evaluation.passed) {
          push('agent.evaluation_failed', { failedChecks: evaluation.failedCheckKeys });
          return this.fail(base, usage, 'FAILED', 'AGENT_EVALUATION_FAILED', evaluation.reason ?? 'Avaliação reprovou.', false, context.securitySignals, null, { repairAttemptCount, evaluation });
        }
        push('agent.evaluation_passed', {});
        if (toolCallingAllowed) await this.checkpoints.markCompleted(input.executionStepId);
        return this.succeed(base, usage, validation.acceptedOutput, context.securitySignals, repairAttemptCount, evaluation.failedCheckKeys, toolCallCount);
      }

      lastValidationErrors = validation.validationErrors;
      push('agent.output_invalid', { errors: (validation.validationErrors ?? []).length, repairAttemptCount });
      if (repairAttemptCount < maxRepairs) {
        repairAttemptCount++;
        modelCallPurpose = 'OUTPUT_REPAIR';
        push('agent.output_repair_started', { attempt: repairAttemptCount });
        messages.push({ role: 'USER', content: [{ type: 'TEXT', text: `${REPAIR_MARKER} corrija a saída para satisfazer o schema. Erros: ${JSON.stringify(validation.validationErrors ?? [])}` }] });
        continue;
      }
      if (maxRepairs > 0) {
        push('agent.output_repair_exhausted', { repairAttemptCount });
        return this.fail(base, usage, 'FAILED', 'AGENT_OUTPUT_REPAIR_EXHAUSTED', 'Tentativas de correção esgotadas.', false, context.securitySignals, null, { repairAttemptCount, validationErrors: lastValidationErrors });
      }
      return this.fail(base, usage, 'FAILED', 'AGENT_OUTPUT_INVALID', 'Saída não valida contra outputSchema.', false, context.securitySignals, null, { repairAttemptCount, validationErrors: lastValidationErrors });
    }
  }

  /**
   * Processa UMA tool call proposta pelo modelo: valida → replay idempotente → avalia
   * autoridade → executa (ALLOW) / cria aprovação e suspende (REQUIRE_APPROVAL) / nega (DENY).
   * NÃO executa em paralelo; NÃO confia no provider.
   */
  private async processToolCall(args: {
    base: RuntimeBase;
    resolved: ResolvedAgentRuntime;
    tools: ResolvedAgentToolDefinition[];
    toolCall: { id: string; alias: string; input?: unknown };
    toolHistory: AgentToolCallHistoryEntry[];
    completed: CompletedToolCallMap;
    toolCallCount: number;
  }): Promise<ToolStep> {
    const { base, resolved, tools, toolCall, toolHistory, completed } = args;
    const input = base.input;
    const push = base.push;
    push('agent.tool_requested', { alias: toolCall.alias, toolCallId: toolCall.id });

    const resolvedTool = tools.find((t) => t.alias === toolCall.alias) ?? null;
    const validation = this.toolValidator.validate({ toolCall, resolvedTool, executionPolicy: resolved.executionPolicy, toolPolicy: resolved.toolPolicy, priorCalls: toolHistory });
    if (!validation.valid) {
      push('agent.tool_call_rejected', { alias: toolCall.alias, code: validation.code });
      if (validation.code === 'AGENT_TOOL_CALL_LIMIT_EXCEEDED') push('agent.tool_limit_exceeded', { alias: toolCall.alias });
      return { kind: 'FAIL', code: validation.code ?? 'AGENT_TOOL_CALL_INVALID', summary: validation.reason ?? 'Tool call inválida.' };
    }
    push('agent.tool_call_validated', { alias: toolCall.alias });
    const tool = resolvedTool!;

    const payload = toolCall.input ?? {};
    const payloadHash = this.toolAuthority.payloadHash(payload);
    const idempotencyKey = `${input.executionStepId}:${toolCall.id}:${payloadHash}`;

    // Replay idempotente: tool já concluída neste step → não reexecuta.
    const prior = completed[idempotencyKey];
    if (prior) {
      push('agent.tool_result_isolated', { alias: tool.alias, replayed: true });
      return { kind: 'CONTINUE', replayed: true, toolCallId: toolCall.id, alias: tool.alias, actionKey: tool.actionKey, riskLevel: tool.riskLevel, decision: 'REPLAY', status: prior.status, inputHash: payloadHash, idempotencyKey, outputHash: prior.outputHash, evidenceReferenceId: prior.evidenceReferenceId, errorCode: prior.errorCode, message: { role: 'TOOL', toolCallId: toolCall.id, content: [{ type: 'TOOL_RESULT', data: { alias: tool.alias, status: prior.status, replayed: true } }] } };
    }

    // Avaliação de autoridade (política do agente + gradiente + ActionAuthorization).
    const decision = await this.toolAuthority.evaluate({
      organizationId: input.organizationId, operationId: input.operationId, operationVersionId: input.operationVersionId,
      executionRunId: input.executionRunId, executionStepId: input.executionStepId, requestedByUserId: input.requestedByUserId,
      correlationId: input.correlationId, alias: tool.alias, actionKey: tool.actionKey, riskLevel: tool.riskLevel,
      toolPolicy: resolved.toolPolicy, toolPayload: payload, now: new Date(),
    });
    push('agent.tool_authority_evaluated', { alias: tool.alias, decision: decision.decision, reasonCode: decision.reasonCode });

    const execInput = {
      organizationId: input.organizationId, operationId: input.operationId, operationVersionId: input.operationVersionId,
      executionRunId: input.executionRunId, executionStepId: input.executionStepId, requestedByUserId: input.requestedByUserId,
      correlationId: input.correlationId, attemptNumber: input.attemptNumber, toolCallId: toolCall.id, idempotencyKey,
      resolvedTool: tool, toolPayload: payload, payloadHash, decision,
    };

    if (decision.decision === 'DENY') {
      const outcome = await this.toolExecutor.deniedOutcome(execInput, 'AGENT_TOOL_DENIED', `Tool negada (${decision.reasonCode}).`, 'DENIED');
      push('agent.tool_execution_failed', { alias: tool.alias, status: 'DENIED', reasonCode: decision.reasonCode });
      return this.continueFrom(outcome, idempotencyKey, payloadHash, decision.decision);
    }

    if (decision.decision === 'REQUIRE_APPROVAL') {
      const approval = await this.toolApproval.createOrGet({
        organizationId: input.organizationId, operationId: input.operationId, operationVersionId: input.operationVersionId,
        requestedByUserId: input.requestedByUserId, correlationId: input.correlationId, executionStepId: input.executionStepId,
        toolPayload: payload, idempotencyKey,
      });
      if (approval.status === 'PENDING') {
        push('agent.tool_approval_requested', { alias: tool.alias, approvalRequestId: approval.approvalRequestId });
        return { kind: 'SUSPEND', approvalRequestId: approval.approvalRequestId, pending: { toolCallId: toolCall.id, idempotencyKey, alias: tool.alias, actionKey: tool.actionKey, riskLevel: tool.riskLevel, inputHash: payloadHash } };
      }
      if (approval.status === 'REJECTED' || approval.status === 'CANCELLED' || approval.status === 'EXPIRED') {
        push('agent.tool_approval_denied', { alias: tool.alias, approvalRequestId: approval.approvalRequestId, status: approval.status });
        const outcome = await this.toolExecutor.deniedOutcome(execInput, 'AGENT_TOOL_DENIED', 'Aprovação negada.', 'DENIED');
        return this.continueFrom(outcome, idempotencyKey, payloadHash, decision.decision);
      }
      // APPROVED sem autorização ativa consumível (janela rara de crash) → incerto.
      return { kind: 'UNKNOWN' };
    }

    // ALLOW → executa uma única vez (consome autorização, se houver).
    push('agent.tool_execution_started', { alias: tool.alias, riskLevel: tool.riskLevel });
    const outcome = await this.toolExecutor.execute(execInput);
    if (outcome.status === 'SUCCEEDED') push('agent.tool_execution_succeeded', { alias: tool.alias });
    else if (outcome.status === 'UNKNOWN') { push('agent.tool_execution_unknown', { alias: tool.alias }); return { kind: 'UNKNOWN' }; }
    else push('agent.tool_execution_failed', { alias: tool.alias, status: outcome.status });
    push('agent.tool_result_isolated', { alias: tool.alias, isolated: outcome.meta.isolated, signals: outcome.meta.securitySignalCount });
    if (decision.authorizationId) push('agent.tool_authorization_consumed', { alias: tool.alias });
    return this.continueFrom(outcome, idempotencyKey, payloadHash, decision.decision);
  }

  /** Converte um `AgentToolCallOutcome` executado num passo CONTINUE. */
  private continueFrom(outcome: import('./tools/agent-tool.types').AgentToolCallOutcome, idempotencyKey: string, inputHash: string, decision: string): ToolStep {
    return {
      kind: 'CONTINUE', replayed: false, toolCallId: outcome.toolCallId, alias: outcome.alias, actionKey: outcome.meta.actionKey,
      riskLevel: outcome.meta.riskLevel, decision, authorizationId: outcome.meta.authorizationId,
      status: outcome.status, inputHash, idempotencyKey, outputHash: outcome.meta.outputHash,
      evidenceReferenceId: outcome.evidenceReferenceIds[0], errorCode: outcome.errorCode,
      message: outcome.toolMessage ?? { role: 'TOOL', toolCallId: outcome.toolCallId, content: [{ type: 'TOOL_RESULT', data: { status: outcome.status } }] },
    };
  }

  /** Emite eventos de trilha do contexto (por fonte, exclusão, truncamento, sinal). */
  private emitContextEvents(push: RuntimeBase['push'], context: AgentContextAssemblyResult): void {
    for (const s of context.includedSources) {
      push('agent.context_source_resolved', { kind: s.kind, ref: s.ref, trust: s.trust, isolated: s.isolated, bytes: s.bytes, redactedHash: s.redactedHash });
      if (s.truncated) push('agent.context_source_truncated', { kind: s.kind, ref: s.ref, bytes: s.bytes });
    }
    for (const e of context.excludedSources) {
      push('agent.context_source_excluded', { kind: e.kind, ref: e.ref, reason: e.reason });
    }
    for (const sig of context.securitySignals) {
      push('agent.context_security_signal_detected', { code: sig.code, severity: sig.severity, source: sig.source, blocked: sig.blocked });
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
    toolCallCount = 0,
  ): AgentRuntimeOutcome {
    const result: AgentExecutionResult = {
      status: 'SUCCEEDED', output,
      usage, modelCallCount: usage.modelCallCount, toolCallCount, turnCount: Math.max(1, usage.modelCallCount),
      evidenceReferenceIds: [], durationMs: usage.durationMs,
    };
    return this.finalize(base, result, true, signals, repairAttemptCount, output, evaluationFailed);
  }

  /** Suspensão para aprovação humana de uma tool call (REQUIRES_APPROVAL). */
  private suspend(
    base: RuntimeBase,
    usage: AgentUsage,
    signals: AgentSecuritySignal[],
    approvalRequestId: string,
    alias: string,
    counts: { turnCount: number; toolCallCount: number },
  ): AgentRuntimeOutcome {
    const result: AgentExecutionResult = {
      status: 'REQUIRES_APPROVAL', errorCode: 'AGENT_TOOL_REQUIRES_APPROVAL', errorSummary: 'Tool call requer aprovação humana.',
      usage, modelCallCount: usage.modelCallCount, toolCallCount: counts.toolCallCount, turnCount: counts.turnCount,
      evidenceReferenceIds: [], durationMs: usage.durationMs,
    };
    return this.finalize(base, result, false, signals, 0, null, [], { approvalRequestId, pendingAlias: alias });
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
      usage, modelCallCount: usage.modelCallCount, toolCallCount: (extra.toolCallCount as number) ?? 0, turnCount: usage.modelCallCount > 0 ? 1 : 0,
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
      modelConfigurationId: resolved.modelConfigurationId,
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
      toolCallCount: safeResult.toolCallCount,
      turnCount: safeResult.turnCount,
      usage: safeResult.usage,
      durationMs: safeResult.durationMs,
      securitySignals: signals,
      evaluationFailedChecks: evaluationFailed,
      contextHash: base.context?.contextHash ?? null,
      contextTruncated: base.context?.truncated ?? false,
      includedSources: base.context?.includedSources ?? [],
      excludedSources: base.context?.excludedSources ?? [],
      // Limites/flags para governança e avaliação operacional (007.6) — sem segredo.
      governance: {
        maxTurns: resolved.executionPolicy.maximumTurns,
        maxToolCalls: resolved.executionPolicy.maximumToolCalls,
        maxDurationMs: resolved.executionPolicy.maximumDurationMs,
        maximumInputTokens: resolved.costPolicy.maximumInputTokens,
        maximumEstimatedCostMinor: resolved.costPolicy.maximumEstimatedCostMinor ?? null,
        costCurrency: resolved.costPolicy.currency ?? null,
        actionOnLimit: resolved.costPolicy.actionOnLimit,
        requireEvidenceReferences: resolved.evaluationPolicy.requireEvidenceReferences,
        policyHash: stableHash({ evaluation: resolved.evaluationPolicy, cost: resolved.costPolicy, execution: resolved.executionPolicy }),
      },
      ...extra,
    };

    const finalAction =
      safeResult.status === 'SUCCEEDED' ? 'agent.execution_completed'
      : safeResult.status === 'REQUIRES_APPROVAL' ? 'agent.execution_suspended'
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
      modelCalls: base.modelCalls,
      toolCalls: base.toolCalls,
    };
  }
}

interface RuntimeBase {
  resolved: ResolvedAgentRuntime;
  events: AgentLifecycleEvent[];
  push: (eventType: string, payload?: Record<string, unknown>) => void;
  input: AgentRuntimeExecutionInput;
  /** Contexto montado (metadados sanitizados) — enriquece a evidência final. */
  context?: AgentContextAssemblyResult;
  /** Uso por chamada de modelo/tool (007.6) — persistido pelo executor. */
  modelCalls: AgentModelCallRecord[];
  toolCalls: AgentToolCallRecord[];
}

/** Resultado do processamento de UMA tool call dentro do loop do runtime. */
type ToolStep =
  | {
      kind: 'CONTINUE';
      replayed: boolean;
      toolCallId: string;
      alias: string;
      actionKey: string;
      riskLevel: string;
      decision: string;
      authorizationId?: string;
      status: string;
      inputHash: string;
      idempotencyKey: string;
      outputHash?: string;
      evidenceReferenceId?: string;
      errorCode?: string;
      message: import('@arden/contracts').ModelMessage;
    }
  | { kind: 'SUSPEND'; approvalRequestId: string; pending: import('./tools/agent-runtime-checkpoint.repository').PendingToolCallMeta }
  | { kind: 'FAIL'; code: string; summary: string }
  | { kind: 'UNKNOWN' };
