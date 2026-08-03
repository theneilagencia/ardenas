/**
 * Arden.AS API — testes do provider determinístico interno (ARDEN-BE-007.3).
 */

import { describe, expect, it } from 'vitest';
import type { ModelGenerationRequest } from '@arden/contracts';
import {
  InternalTestModelProvider,
  buildValidOutput,
  isInternalTestModelId,
  REPAIR_MARKER,
  INTERNAL_TEST_MODEL_IDS,
} from './internal-test-model.provider';
import { ModelProviderInvocationError } from './model-provider.errors';

const provider = new InternalTestModelProvider();
const schema = { type: 'object', properties: { grade: { type: 'string' } }, required: ['grade'] };

function req(modelId: string, withRepair = false): ModelGenerationRequest {
  return {
    providerKey: 'internal.test-model', providerVersion: '1', modelId,
    systemInstructions: 'sys', messages: withRepair
      ? [{ role: 'USER', content: [{ type: 'TEXT', text: `${REPAIR_MARKER} corrija` }] }]
      : [{ role: 'USER', content: [{ type: 'TEXT', text: 'oi' }] }],
    tools: [], outputSchema: schema, maximumInputTokens: 1000, maximumOutputTokens: 1000, correlationId: 'c1',
  };
}

describe('buildValidOutput', () => {
  it('gera objeto que satisfaz required + tipos', () => {
    expect(buildValidOutput(schema)).toEqual({ grade: 'ok' });
    expect(buildValidOutput({ type: 'object', properties: { n: { type: 'number' } }, required: ['n'] })).toEqual({ n: 0 });
    expect(buildValidOutput({ type: 'string', enum: ['a', 'b'] })).toBe('a');
  });
});

describe('InternalTestModelProvider', () => {
  it('allowlist de modelIds', () => {
    expect(isInternalTestModelId('test/structured-success')).toBe(true);
    expect(isInternalTestModelId('gpt-4')).toBe(false);
    expect(INTERNAL_TEST_MODEL_IDS.length).toBe(18);
    expect(isInternalTestModelId('test/tool-read-success')).toBe(true);
  });

  it('success → structured output válido + usage determinística', async () => {
    const r = await provider.generate(req('test/structured-success'));
    expect(r.finishReason).toBe('STOP');
    expect(r.structuredOutput).toEqual({ grade: 'ok' });
    expect(r.toolCalls).toEqual([]);
    expect(r.usage.modelCallCount).toBe(1);
    expect(r.usage.estimatedCostMinor).toBeNull();
  });

  it('invalid → output que falha o schema', async () => {
    const r = await provider.generate(req('test/structured-invalid'));
    expect(r.structuredOutput).toEqual({ __invalid: true });
  });

  it('repairable → inválido sem marcador; válido com marcador de repair', async () => {
    expect((await provider.generate(req('test/structured-repairable', false))).structuredOutput).toEqual({ __invalid: true });
    expect((await provider.generate(req('test/structured-repairable', true))).structuredOutput).toEqual({ grade: 'ok' });
  });

  it('content-filtered → finishReason CONTENT_FILTER', async () => {
    expect((await provider.generate(req('test/content-filtered'))).finishReason).toBe('CONTENT_FILTER');
  });

  it('cenários de erro lançam ModelProviderInvocationError com o kind correto', async () => {
    await expect(provider.generate(req('test/timeout'))).rejects.toMatchObject({ kind: 'TIMEOUT' });
    await expect(provider.generate(req('test/rate-limit'))).rejects.toMatchObject({ kind: 'RATE_LIMIT' });
    await expect(provider.generate(req('test/provider-error'))).rejects.toMatchObject({ kind: 'PROVIDER_ERROR' });
    await expect(provider.generate(req('test/unknown-result'))).rejects.toMatchObject({ kind: 'UNKNOWN' });
  });

  it('modelId fora da allowlist → UNSUPPORTED_MODEL', async () => {
    await expect(provider.generate(req('gpt-4'))).rejects.toBeInstanceOf(ModelProviderInvocationError);
    await expect(provider.generate(req('gpt-4'))).rejects.toMatchObject({ kind: 'UNSUPPORTED_MODEL' });
  });

  it('nunca produz tool calls', async () => {
    for (const id of ['test/structured-success', 'test/structured-repairable']) {
      expect((await provider.generate(req(id))).toolCalls).toEqual([]);
    }
  });
});
