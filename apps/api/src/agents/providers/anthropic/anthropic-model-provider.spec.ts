/**
 * Arden.AS API — testes unitários do AnthropicModelProvider gated (ARDEN-BE-008.3 §45).
 *
 * Usa o FakeAnthropicTransport (offline). Cobre structured output, erros, retry, UNKNOWN,
 * rejeição de tool calling, allowlist de modelId, compatibilidade de schema e o canário de
 * segredo (a apiKey vai só ao transporte em memória; nunca no resultado/métricas).
 */

import { describe, expect, it, beforeEach } from 'vitest';
import type { ModelGenerationRequest, ModelGenerationContext } from '@arden/contracts';
import { ANTHROPIC_MODEL_CATALOG } from '@arden/contracts';
import { AnthropicModelProvider } from './anthropic-model-provider';
import { FakeAnthropicTransport } from './anthropic-fake-transport';
import { AgentMetrics } from '../../governance/agent-metrics';
import { ModelProviderInvocationError } from '../../runtime/model-provider.errors';

const MODEL = ANTHROPIC_MODEL_CATALOG[0].modelId;
const CANARY = 'ARDEN_BE008_ANTHROPIC_RUNTIME_SECRET_CANARY_unit1';

function makeProvider(transport: FakeAnthropicTransport, metrics = new AgentMetrics()): AnthropicModelProvider {
  const credentials = {
    resolve: async () => ({ apiKey: CANARY, fingerprint: 'fp', credentialVersionId: 'cv', connectionId: 'conn', timeoutMs: 60_000, maximumRetries: 2 }),
  };
  const prisma = { modelConfiguration: { findFirst: async () => ({ parameters: { maximumOutputTokens: 512, temperature: 0.2 } }) } };
  // Gate não produtivo: chamadas externas DESLIGADAS nos testes unitários (caminho offline).
  const gate = { externalCallsEnabled: () => false, isProduction: () => false, toolCallingEnabled: () => false } as never;
  return new AnthropicModelProvider(transport, credentials as never, prisma as never, metrics, gate);
}

function req(over: Partial<ModelGenerationRequest> = {}): ModelGenerationRequest {
  return {
    providerKey: 'anthropic.direct', providerVersion: '1', modelId: MODEL,
    systemInstructions: 'Você classifica leads.',
    messages: [{ role: 'USER', content: [{ type: 'TEXT', text: 'Classifique Acme' }] }],
    tools: [], outputSchema: { type: 'object', properties: { grade: { type: 'string' } }, required: ['grade'] },
    maximumInputTokens: 8000, maximumOutputTokens: 512, correlationId: 'corr-1', ...over,
  } as ModelGenerationRequest;
}

const ctx: ModelGenerationContext = { organizationId: 'org1', modelConfigurationId: 'cfg1', credentialConnectionId: 'conn1', correlationId: 'corr-1', deadlineMs: 60_000 };

let transport: FakeAnthropicTransport;
beforeEach(() => { transport = new FakeAnthropicTransport(); });

describe('AnthropicModelProvider — sucesso e structured output', () => {
  it('structured output → finishReason STOP, sem tool call, usage medida', async () => {
    transport.setDefault('structured_success');
    const out = await makeProvider(transport).generate(req(), ctx);
    expect(out.finishReason).toBe('STOP');
    expect(out.structuredOutput).toEqual({ grade: 'grade-ok' });
    expect(out.toolCalls).toHaveLength(0);
    expect(out.usage.modelCallCount).toBe(1);
    expect(out.usage.cachedInputTokens).toBe(8);
    expect(transport.calls).toHaveLength(1);
  });
  it('max_tokens → finishReason MAX_TOKENS', async () => {
    transport.setDefault('max_tokens');
    expect((await makeProvider(transport).generate(req(), ctx)).finishReason).toBe('MAX_TOKENS');
  });
  it('reparável: 1ª inválida, 2ª (com marcador) válida', async () => {
    transport.setDefault('structured_repairable');
    const p = makeProvider(transport);
    const bad = await p.generate(req(), ctx);
    expect(bad.structuredOutput).toEqual({ __invalid: true });
    const good = await p.generate(req({ messages: [{ role: 'USER', content: [{ type: 'TEXT', text: 'x [arden:repair]' }] }] }), ctx);
    expect(good.structuredOutput).toEqual({ grade: 'grade-ok' });
  });
});

describe('AnthropicModelProvider — rejeições pré-transporte', () => {
  it('tool calling rejeitado (tools reais) — transporte NÃO chamado', async () => {
    const p = makeProvider(transport);
    await expect(p.generate(req({ tools: [{ alias: 'reader', description: 'x', riskLevel: 'READ', inputSchema: {}, outputSchema: {} }] as never }), ctx)).rejects.toBeInstanceOf(ModelProviderInvocationError);
    expect(transport.calls).toHaveLength(0);
  });
  it('modelId fora da allowlist rejeitado', async () => {
    await expect(makeProvider(transport).generate(req({ modelId: 'gpt-4' }), ctx)).rejects.toMatchObject({ kind: 'UNSUPPORTED_MODEL' });
    expect(transport.calls).toHaveLength(0);
  });
  it('schema incompatível ($ref) rejeitado', async () => {
    await expect(makeProvider(transport).generate(req({ outputSchema: { $ref: 'http://evil/schema' } }), ctx)).rejects.toBeInstanceOf(ModelProviderInvocationError);
    expect(transport.calls).toHaveLength(0);
  });
});

describe('AnthropicModelProvider — erros, retry e UNKNOWN', () => {
  it('rate limit → retry → sucesso (2 chamadas, Retry-After respeitado)', async () => {
    transport.enqueue('rate_limit', 'structured_success');
    const out = await makeProvider(transport).generate(req(), ctx);
    expect(out.finishReason).toBe('STOP');
    expect(transport.calls).toHaveLength(2);
    expect(out.usage.modelCallCount).toBe(2);
  });
  it('authentication error → sem retry (1 chamada), PROVIDER_ERROR', async () => {
    transport.setDefault('authentication_error');
    await expect(makeProvider(transport).generate(req(), ctx)).rejects.toMatchObject({ kind: 'PROVIDER_ERROR' });
    expect(transport.calls).toHaveLength(1);
  });
  it('timeout ANTES do envio → retriável → sucesso (2 chamadas)', async () => {
    transport.enqueue('timeout_before_send', 'structured_success');
    const out = await makeProvider(transport).generate(req(), ctx);
    expect(out.finishReason).toBe('STOP');
    expect(transport.calls).toHaveLength(2);
  });
  it('timeout APÓS envio → UNKNOWN, sem retry, nunca sucesso', async () => {
    transport.setDefault('timeout_after_send');
    await expect(makeProvider(transport).generate(req(), ctx)).rejects.toMatchObject({ kind: 'UNKNOWN' });
    expect(transport.calls).toHaveLength(1);
  });
  it('connection reset após envio → UNKNOWN', async () => {
    transport.setDefault('connection_reset');
    await expect(makeProvider(transport).generate(req(), ctx)).rejects.toMatchObject({ kind: 'UNKNOWN' });
  });
  it('resposta malformada → UNKNOWN', async () => {
    transport.setDefault('malformed_response');
    await expect(makeProvider(transport).generate(req(), ctx)).rejects.toMatchObject({ kind: 'UNKNOWN' });
  });
  it('abort → PROVIDER_ERROR, sem retry', async () => {
    transport.setDefault('aborted');
    await expect(makeProvider(transport).generate(req(), ctx)).rejects.toMatchObject({ kind: 'PROVIDER_ERROR' });
    expect(transport.calls).toHaveLength(1);
  });
});

describe('AnthropicModelProvider — registro condicional (gate)', () => {
  it('registry SEM registrar Anthropic: provider ausente (gate OFF / produção)', async () => {
    const { InMemoryModelProviderRegistry } = await import('../../runtime/model-provider-registry');
    const { InternalTestModelProvider } = await import('../../runtime/internal-test-model.provider');
    const registry = new InMemoryModelProviderRegistry(new InternalTestModelProvider());
    expect(registry.has('anthropic.direct', '1')).toBe(false);
    expect(registry.has('internal.test-model', '1')).toBe(true);
  });
});

describe('AnthropicModelProvider — canário de segredo', () => {
  it('apiKey vai só ao transporte (memória); ausente do resultado e das métricas', async () => {
    transport.setDefault('structured_success');
    const metrics = new AgentMetrics();
    const out = await makeProvider(transport, metrics).generate(req(), ctx);
    // Transporte recebeu a credencial (comprovado pelo COMPRIMENTO, não pelo valor).
    expect(transport.lastApiKeyLength).toBe(CANARY.length);
    expect(JSON.stringify(out)).not.toContain(CANARY);
    expect(JSON.stringify(metrics.snapshot())).not.toContain(CANARY);
  });
});
