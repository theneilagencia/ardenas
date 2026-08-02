/**
 * Arden.AS API — testes do runtime determinístico de agentes (ARDEN-BE-007.3 §33).
 * Usa um resolver FAKE + o provider interno real. Sem DB, sem rede.
 */

import { describe, expect, it } from 'vitest';
import {
  agentContextPolicy,
  agentExecutionPolicy,
  agentEvaluationPolicy,
  agentToolPolicy,
  agentCostPolicy,
  AGENT_CONTEXT_POLICY_SAFE_DEFAULT,
  AGENT_EXECUTION_POLICY_SLICE_DEFAULT,
  AGENT_EVALUATION_POLICY_SAFE_DEFAULT,
  AGENT_TOOL_POLICY_SAFE_DEFAULT,
  AGENT_COST_POLICY_SAFE_DEFAULT,
} from '@arden/contracts';
import { AgentRuntimeService } from './agent-runtime';
import { AgentRuntimeResolverService } from './agent-runtime-resolver';
import { InMemoryModelProviderRegistry } from './model-provider-registry';
import { InternalTestModelProvider } from './internal-test-model.provider';
import { AgentContextAssemblerV1 } from './agent-context-assembler';
import { AgentOutputValidatorV1 } from './agent-output-validator';
import { AgentEvaluatorV1 } from './agent-evaluator';
import type { ResolvedAgentRuntime, AgentRuntimeExecutionInput } from './agent-runtime.types';

const OUT_SCHEMA = { type: 'object', properties: { grade: { type: 'string' } }, required: ['grade'] };

function resolved(modelId: string, over: Partial<ResolvedAgentRuntime> = {}): ResolvedAgentRuntime {
  return {
    agentDefinitionId: 'a1', agentVersionId: 'v1', agentKey: 'k', versionNumber: 1, contentHash: 'h',
    modelConfigurationId: 'c1', providerKey: 'internal.test-model', providerVersion: '1', modelId,
    providerProductionAllowed: false,
    objective: 'classificar', systemInstructions: 'instruções',
    inputSchema: { type: 'object', properties: { lead: { type: 'string' } }, required: ['lead'] },
    outputSchema: OUT_SCHEMA,
    contextPolicy: agentContextPolicy.parse(AGENT_CONTEXT_POLICY_SAFE_DEFAULT),
    executionPolicy: agentExecutionPolicy.parse(AGENT_EXECUTION_POLICY_SLICE_DEFAULT),
    toolPolicy: agentToolPolicy.parse(AGENT_TOOL_POLICY_SAFE_DEFAULT),
    evaluationPolicy: agentEvaluationPolicy.parse(AGENT_EVALUATION_POLICY_SAFE_DEFAULT),
    costPolicy: agentCostPolicy.parse(AGENT_COST_POLICY_SAFE_DEFAULT),
    ...over,
  };
}

function makeRuntime(res: ResolvedAgentRuntime): AgentRuntimeService {
  const fakeResolver = { resolveForExecution: async () => res } as unknown as AgentRuntimeResolverService;
  return new AgentRuntimeService(
    fakeResolver,
    new InMemoryModelProviderRegistry(new InternalTestModelProvider()),
    new AgentContextAssemblerV1(),
    new AgentOutputValidatorV1(),
    new AgentEvaluatorV1(),
  );
}

const INPUT: AgentRuntimeExecutionInput = {
  organizationId: 'o1', operationId: 'op1', operationVersionId: 'ov1', executionRunId: 'r1', executionStepId: 's1',
  agentDefinitionId: 'a1', agentVersionId: 'v1', input: { lead: 'Acme' }, correlationId: 'corr', attemptNumber: 1, timeoutMs: 0,
};

describe('AgentRuntime — sucesso e usage', () => {
  it('structured output válido → SUCCEEDED, usage e evidência', async () => {
    const out = await makeRuntime(resolved('test/structured-success')).execute(INPUT);
    expect(out.result.status).toBe('SUCCEEDED');
    expect(out.result.output).toEqual({ grade: 'ok' });
    expect(out.result.modelCallCount).toBe(1);
    expect(out.result.toolCallCount).toBe(0);
    expect(out.result.turnCount).toBe(1);
    expect(out.result.usage.estimatedCostMinor).toBeNull();
    expect(out.evidence.contentHash).toBe('h');
    expect(out.evidence.status).toBe('SUCCEEDED');
    expect(out.events.map((e) => e.eventType)).toContain('agent.execution_completed');
  });
});

describe('AgentRuntime — output inválido e repair', () => {
  it('inválido sem repair → AGENT_OUTPUT_INVALID (não sucesso)', async () => {
    const res = resolved('test/structured-invalid', { executionPolicy: agentExecutionPolicy.parse({ ...AGENT_EXECUTION_POLICY_SLICE_DEFAULT, retryInvalidOutput: false, maximumOutputRepairAttempts: 0 }) });
    const out = await makeRuntime(res).execute(INPUT);
    expect(out.result.status).toBe('FAILED');
    expect(out.result.errorCode).toBe('AGENT_OUTPUT_INVALID');
    expect(out.result.modelCallCount).toBe(1);
  });

  it('repairable → 1ª inválida, 2ª válida → SUCCEEDED, modelCallCount=2, repairAttemptCount=1', async () => {
    const out = await makeRuntime(resolved('test/structured-repairable')).execute(INPUT);
    expect(out.result.status).toBe('SUCCEEDED');
    expect(out.result.modelCallCount).toBe(2);
    expect(out.evidence.repairAttemptCount).toBe(1);
    const types = out.events.map((e) => e.eventType);
    expect(types).toContain('agent.output_invalid');
    expect(types).toContain('agent.output_repair_started');
  });

  it('todas inválidas com repair habilitado → AGENT_OUTPUT_REPAIR_EXHAUSTED', async () => {
    const out = await makeRuntime(resolved('test/structured-invalid')).execute(INPUT);
    expect(out.result.status).toBe('FAILED');
    expect(out.result.errorCode).toBe('AGENT_OUTPUT_REPAIR_EXHAUSTED');
    expect(out.result.modelCallCount).toBe(2); // 1 + 1 repair
    expect(out.events.map((e) => e.eventType)).toContain('agent.output_repair_exhausted');
  });
});

describe('AgentRuntime — classificação de erros do provider', () => {
  it('timeout → AGENT_TIMEOUT (retryable)', async () => {
    const out = await makeRuntime(resolved('test/timeout')).execute(INPUT);
    expect(out.result.errorCode).toBe('AGENT_TIMEOUT');
    expect(out.retryable).toBe(true);
  });
  it('rate limit → MODEL_RATE_LIMITED', async () => {
    expect((await makeRuntime(resolved('test/rate-limit')).execute(INPUT)).result.errorCode).toBe('MODEL_RATE_LIMITED');
  });
  it('provider error → MODEL_PROVIDER_ERROR', async () => {
    expect((await makeRuntime(resolved('test/provider-error')).execute(INPUT)).result.errorCode).toBe('MODEL_PROVIDER_ERROR');
  });
  it('content filtered → MODEL_CONTENT_FILTERED', async () => {
    expect((await makeRuntime(resolved('test/content-filtered')).execute(INPUT)).result.errorCode).toBe('MODEL_CONTENT_FILTERED');
  });
  it('unknown result → UNKNOWN (não vira SUCCEEDED), não retryable', async () => {
    const out = await makeRuntime(resolved('test/unknown-result')).execute(INPUT);
    expect(out.result.status).toBe('UNKNOWN');
    expect(out.result.errorCode).toBe('MODEL_RESULT_UNKNOWN');
    expect(out.retryable).toBe(false);
    expect(out.events.map((e) => e.eventType)).toContain('agent.execution_unknown');
  });
});

describe('AgentRuntime — validações de entrada e limites', () => {
  it('input inválido contra inputSchema → AGENT_INPUT_INVALID', async () => {
    const out = await makeRuntime(resolved('test/structured-success')).execute({ ...INPUT, input: { notLead: 1 } });
    expect(out.result.errorCode).toBe('AGENT_INPUT_INVALID');
  });

  it('tool calling habilitado → rejeitado (não suportado nesta fase)', async () => {
    const res = resolved('test/structured-success', { executionPolicy: agentExecutionPolicy.parse({ ...AGENT_EXECUTION_POLICY_SLICE_DEFAULT, toolCallingAllowed: true, maximumToolCalls: 2 }) });
    expect((await makeRuntime(res).execute(INPUT)).result.errorCode).toBe('AGENT_TOOL_NOT_ALLOWED');
  });

  it('contexto acima de maximumInputTokens → AGENT_TOKEN_LIMIT_EXCEEDED', async () => {
    const ctx = agentContextPolicy.parse({ ...AGENT_CONTEXT_POLICY_SAFE_DEFAULT, maximumInputTokens: 1 });
    const exec = agentExecutionPolicy.parse({ ...AGENT_EXECUTION_POLICY_SLICE_DEFAULT, maximumInputTokens: 1 });
    expect((await makeRuntime(resolved('test/structured-success', { contextPolicy: ctx, executionPolicy: exec })).execute(INPUT)).result.errorCode).toBe('AGENT_TOKEN_LIMIT_EXCEEDED');
  });

  it('bloqueio determinístico de injeção → AGENT_PROMPT_INJECTION_DETECTED', async () => {
    const out = await makeRuntime(resolved('test/structured-success')).execute({ ...INPUT, input: { lead: 'x', __ardenInjectionProbe: true } });
    expect(out.result.errorCode).toBe('AGENT_PROMPT_INJECTION_DETECTED');
  });
});

describe('AgentRuntime — avaliação e canário de segredo', () => {
  it('required output path ausente → AGENT_EVALUATION_FAILED', async () => {
    const evalPolicy = agentEvaluationPolicy.parse({ ...AGENT_EVALUATION_POLICY_SAFE_DEFAULT, requiredOutputPaths: ['missing.deep'] });
    expect((await makeRuntime(resolved('test/structured-success', { evaluationPolicy: evalPolicy })).execute(INPUT)).result.errorCode).toBe('AGENT_EVALUATION_FAILED');
  });

  it('llmJudge habilitado → reprova (não suportado)', async () => {
    const evalPolicy = agentEvaluationPolicy.parse({ ...AGENT_EVALUATION_POLICY_SAFE_DEFAULT, deterministicChecks: [{ key: 'output.schema_valid', configuration: {} }], llmJudge: { enabled: true, advisoryOnly: false, modelConfigurationId: null } });
    expect((await makeRuntime(resolved('test/structured-success', { evaluationPolicy: evalPolicy })).execute(INPUT)).result.errorCode).toBe('AGENT_EVALUATION_FAILED');
  });

  it('canário injetado no input não aparece na evidência (redação)', async () => {
    const CANARY = 'ARDEN_BE007_RUNTIME_SECRET_CANARY_unit';
    const out = await makeRuntime(resolved('test/structured-success')).execute({ ...INPUT, input: { lead: 'Acme', secret: CANARY, apiKey: CANARY } });
    expect(JSON.stringify(out.evidence).includes(CANARY)).toBe(false);
    expect(JSON.stringify(out.events).includes(CANARY)).toBe(false);
  });
});
