/**
 * Arden.AS API — testes de unidades do runtime (ARDEN-BE-007.3):
 * registry, validador de saída, avaliador, assembler e estimador de tokens.
 */

import { describe, expect, it } from 'vitest';
import { InMemoryModelProviderRegistry } from './model-provider-registry';
import { InternalTestModelProvider } from './internal-test-model.provider';
import { AgentOutputValidatorV1 } from './agent-output-validator';
import { AgentEvaluatorV1 } from './agent-evaluator';
import { AgentContextAssemblerV1 } from './agent-context-assembler';
import { estimateTokens, estimateTokensFromString } from './token-estimator';
import {
  agentContextPolicy,
  agentEvaluationPolicy,
  AGENT_CONTEXT_POLICY_SAFE_DEFAULT,
  AGENT_EVALUATION_POLICY_SAFE_DEFAULT,
} from '@arden/contracts';

describe('InMemoryModelProviderRegistry', () => {
  const registry = new InMemoryModelProviderRegistry(new InternalTestModelProvider());
  it('resolve o provider interno por key/version', () => {
    expect(registry.get('internal.test-model', '1')).toBeTruthy();
    expect(registry.has('internal.test-model', '1')).toBe(true);
  });
  it('provider desconhecido → MODEL_PROVIDER_NOT_AVAILABLE', () => {
    expect(() => registry.get('acme.gpt', '1')).toThrowError(/Provider não registrado|indispon/i);
  });
});

describe('AgentOutputValidatorV1', () => {
  const v = new AgentOutputValidatorV1();
  const schema = { type: 'object', properties: { grade: { type: 'string' } }, required: ['grade'] };
  it('válido', () => {
    expect(v.validate({ schema, rawOutput: { grade: 'A' }, maximumOutputBytes: 1000, repairAttemptCount: 0 }).valid).toBe(true);
  });
  it('inválido (schema)', () => {
    const r = v.validate({ schema, rawOutput: { x: 1 }, maximumOutputBytes: 1000, repairAttemptCount: 0 });
    expect(r.valid).toBe(false);
    expect(r.validationErrors?.length).toBeGreaterThan(0);
  });
  it('excede maximumOutputBytes', () => {
    const r = v.validate({ schema, rawOutput: { grade: 'x'.repeat(100) }, maximumOutputBytes: 10, repairAttemptCount: 0 });
    expect(r.valid).toBe(false);
    expect(r.validationErrors?.[0].code).toBe('OUTPUT_TOO_LARGE');
  });
});

describe('AgentEvaluatorV1', () => {
  const e = new AgentEvaluatorV1();
  const base = agentEvaluationPolicy.parse(AGENT_EVALUATION_POLICY_SAFE_DEFAULT);
  it('passa com output schema válido', () => {
    expect(e.evaluate({ policy: base, acceptedOutput: { grade: 'A' }, outputSchemaValid: true, evidenceReferenceIds: [] }).passed).toBe(true);
  });
  it('required path ausente reprova', () => {
    const p = agentEvaluationPolicy.parse({ ...AGENT_EVALUATION_POLICY_SAFE_DEFAULT, requiredOutputPaths: ['a.b'] });
    expect(e.evaluate({ policy: p, acceptedOutput: {}, outputSchemaValid: true, evidenceReferenceIds: [] }).passed).toBe(false);
  });
  it('forbidden path presente reprova', () => {
    const p = agentEvaluationPolicy.parse({ ...AGENT_EVALUATION_POLICY_SAFE_DEFAULT, forbiddenOutputPaths: ['secret'] });
    expect(e.evaluate({ policy: p, acceptedOutput: { secret: 1 }, outputSchemaValid: true, evidenceReferenceIds: [] }).passed).toBe(false);
  });
  it('llmJudge habilitado → não suportado (reprova com motivo)', () => {
    const p = agentEvaluationPolicy.parse({ ...AGENT_EVALUATION_POLICY_SAFE_DEFAULT, llmJudge: { enabled: true, advisoryOnly: false, modelConfigurationId: null } });
    const r = e.evaluate({ policy: p, acceptedOutput: {}, outputSchemaValid: true, evidenceReferenceIds: [] });
    expect(r.passed).toBe(false);
    expect(r.reason).toMatch(/judge/i);
  });
});

describe('AgentContextAssemblerV1', () => {
  const a = new AgentContextAssemblerV1();
  const policy = agentContextPolicy.parse(AGENT_CONTEXT_POLICY_SAFE_DEFAULT);
  it('monta mensagens com objetivo + input redigido; sem tools', () => {
    const r = a.assemble({ organizationId: 'o', contextPolicy: policy, objective: 'obj', systemInstructions: 'sys', executionInput: { lead: 'x', secret: 'S3CR3T' }, correlationId: 'c' });
    expect(r.tools).toEqual([]);
    expect(r.systemInstructions).toBe('sys');
    expect(JSON.stringify(r.messages).includes('S3CR3T')).toBe(false); // redigido
    expect(r.contextBytes).toBeGreaterThan(0);
    expect(r.estimatedInputTokens).toBeGreaterThan(0);
  });
  it('marcador explícito de injeção → sinal CRITICAL blocked', () => {
    const r = a.assemble({ organizationId: 'o', contextPolicy: policy, objective: 'obj', systemInstructions: 'sys', executionInput: { __ardenInjectionProbe: true }, correlationId: 'c' });
    expect(r.securitySignals.some((s) => s.blocked && s.severity === 'CRITICAL')).toBe(true);
  });
});

describe('token estimator', () => {
  it('ceil(bytes/4) determinístico', () => {
    expect(estimateTokensFromString('abcd')).toBe(1);
    expect(estimateTokensFromString('abcde')).toBe(2);
    expect(estimateTokens({ a: 1 })).toBe(estimateTokensFromString(JSON.stringify({ a: 1 })));
  });
});
