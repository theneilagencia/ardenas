/**
 * Arden.AS API — testes de unidade do tool calling (ARDEN-BE-007.5 §35).
 * Componentes PUROS: validação de tool call. Sem DB, sem rede.
 */

import { describe, expect, it } from 'vitest';
import { agentExecutionPolicy, agentToolPolicy, AGENT_EXECUTION_POLICY_SLICE_DEFAULT, AGENT_TOOL_POLICY_SAFE_DEFAULT } from '@arden/contracts';
import { AgentToolCallValidator } from './agent-tool-call-validator';
import type { ResolvedAgentToolDefinition } from './agent-tool.types';

const v = new AgentToolCallValidator();
const execPolicy = agentExecutionPolicy.parse({ ...AGENT_EXECUTION_POLICY_SLICE_DEFAULT, toolCallingAllowed: true, maximumToolCalls: 2, maximumTurns: 4 });
const tool: ResolvedAgentToolDefinition = { alias: 'reader', description: 'd', inputSchema: { type: 'object', additionalProperties: true }, riskLevel: 'READ', actionKey: 'connector.test.echo' };
const tp = (over: Record<string, unknown> = {}) => agentToolPolicy.parse({ ...AGENT_TOOL_POLICY_SAFE_DEFAULT, allowedAliases: ['reader'], ...over });
const call = (over: Record<string, unknown> = {}) => ({ id: 'tc_1', alias: 'reader', input: { value: 'ok' }, ...over });

describe('AgentToolCallValidator', () => {
  it('válido → ok', () => {
    expect(v.validate({ toolCall: call(), resolvedTool: tool, executionPolicy: execPolicy, toolPolicy: tp(), priorCalls: [] }).valid).toBe(true);
  });
  it('alias não allowlistado → AGENT_TOOL_NOT_ALLOWED', () => {
    const r = v.validate({ toolCall: call({ alias: 'other' }), resolvedTool: null, executionPolicy: execPolicy, toolPolicy: tp(), priorCalls: [] });
    expect(r.code).toBe('AGENT_TOOL_NOT_ALLOWED');
  });
  it('resolvedTool ausente (indisponível) → AGENT_TOOL_NOT_ALLOWED', () => {
    expect(v.validate({ toolCall: call(), resolvedTool: null, executionPolicy: execPolicy, toolPolicy: tp(), priorCalls: [] }).code).toBe('AGENT_TOOL_NOT_ALLOWED');
  });
  it('id ausente → AGENT_TOOL_CALL_INVALID', () => {
    expect(v.validate({ toolCall: call({ id: '' }), resolvedTool: tool, executionPolicy: execPolicy, toolPolicy: tp(), priorCalls: [] }).code).toBe('AGENT_TOOL_CALL_INVALID');
  });
  it('propriedade de controle (organizationId) → AGENT_TOOL_CALL_INVALID', () => {
    expect(v.validate({ toolCall: call({ input: { organizationId: 'x' } }), resolvedTool: tool, executionPolicy: execPolicy, toolPolicy: tp(), priorCalls: [] }).code).toBe('AGENT_TOOL_CALL_INVALID');
  });
  it('propriedade de controle aninhada (connectionId) → AGENT_TOOL_CALL_INVALID', () => {
    expect(v.validate({ toolCall: call({ input: { a: { connectionId: 'c' } } }), resolvedTool: tool, executionPolicy: execPolicy, toolPolicy: tp(), priorCalls: [] }).code).toBe('AGENT_TOOL_CALL_INVALID');
  });
  it('authorization no input → AGENT_TOOL_CALL_INVALID', () => {
    expect(v.validate({ toolCall: call({ input: { authorization: 'Bearer x' } }), resolvedTool: tool, executionPolicy: execPolicy, toolPolicy: tp(), priorCalls: [] }).code).toBe('AGENT_TOOL_CALL_INVALID');
  });
  it('URL absoluta no input → AGENT_TOOL_CALL_INVALID', () => {
    expect(v.validate({ toolCall: call({ input: { target: 'https://evil.example' } }), resolvedTool: tool, executionPolicy: execPolicy, toolPolicy: tp(), priorCalls: [] }).code).toBe('AGENT_TOOL_CALL_INVALID');
  });
  it('input não serializável (BigInt) → AGENT_TOOL_CALL_INVALID', () => {
    expect(v.validate({ toolCall: call({ input: { n: BigInt(1) } }), resolvedTool: tool, executionPolicy: execPolicy, toolPolicy: tp(), priorCalls: [] }).code).toBe('AGENT_TOOL_CALL_INVALID');
  });
  it('input acima do tamanho máximo → AGENT_TOOL_CALL_INVALID', () => {
    expect(v.validate({ toolCall: call({ input: { big: 'x'.repeat(40_000) } }), resolvedTool: tool, executionPolicy: execPolicy, toolPolicy: tp(), priorCalls: [] }).code).toBe('AGENT_TOOL_CALL_INVALID');
  });
  it('teto total de tool calls → AGENT_TOOL_CALL_LIMIT_EXCEEDED', () => {
    const priorCalls = [{ alias: 'reader', toolCallId: 'a', status: 'SUCCEEDED', inputHash: 'h' }, { alias: 'reader', toolCallId: 'b', status: 'SUCCEEDED', inputHash: 'h' }];
    expect(v.validate({ toolCall: call(), resolvedTool: tool, executionPolicy: execPolicy, toolPolicy: tp(), priorCalls }).code).toBe('AGENT_TOOL_CALL_LIMIT_EXCEEDED');
  });
  it('teto por alias → AGENT_TOOL_CALL_LIMIT_EXCEEDED', () => {
    const priorCalls = [{ alias: 'reader', toolCallId: 'a', status: 'SUCCEEDED', inputHash: 'h' }];
    expect(v.validate({ toolCall: call(), resolvedTool: tool, executionPolicy: execPolicy, toolPolicy: tp({ maximumCallsPerAlias: { reader: 1 } }), priorCalls }).code).toBe('AGENT_TOOL_CALL_LIMIT_EXCEEDED');
  });
  it('input viola schema da ferramenta → AGENT_TOOL_CALL_INVALID', () => {
    const strictTool: ResolvedAgentToolDefinition = { ...tool, inputSchema: { type: 'object', properties: { n: { type: 'number' } }, required: ['n'], additionalProperties: false } };
    expect(v.validate({ toolCall: call({ input: { value: 'ok' } }), resolvedTool: strictTool, executionPolicy: execPolicy, toolPolicy: tp(), priorCalls: [] }).code).toBe('AGENT_TOOL_CALL_INVALID');
  });
});
