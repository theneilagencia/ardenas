/**
 * Arden.AS API — testes dos mappers do Anthropic (ARDEN-BE-008.1).
 * Request/response/finishReason/usage/error/retry. Nenhum tipo de SDK; nenhuma rede;
 * nenhum segredo/org no payload. Resultado incerto → UNKNOWN (sem retry cego).
 */

import { describe, expect, it } from 'vitest';
import type { ModelGenerationRequest } from '@arden/contracts';
import { ANTHROPIC_MODEL_CATALOG } from '@arden/contracts';
import { AnthropicRequestMapper, ANTHROPIC_STRUCTURED_OUTPUT_TOOL } from './anthropic-request-mapper';
import { AnthropicResponseMapper, mapAnthropicStopReason } from './anthropic-response-mapper';
import { AnthropicErrorMapper } from './anthropic-error-mapper';
import { decideAnthropicRetry, ANTHROPIC_RETRY_DEFAULT } from './anthropic-retry-policy';
import type { AnthropicTransportResponse } from './anthropic-transport.types';

const MODEL = ANTHROPIC_MODEL_CATALOG[0].modelId;

function req(over: Partial<ModelGenerationRequest> = {}): ModelGenerationRequest {
  return {
    providerKey: 'anthropic.direct',
    providerVersion: '1',
    modelId: MODEL,
    systemInstructions: 'Você classifica leads.',
    messages: [{ role: 'USER', content: [{ type: 'TEXT', text: 'Classifique Acme' }] }],
    tools: [],
    maximumInputTokens: 8000,
    maximumOutputTokens: 512,
    correlationId: 'corr-1',
    ...over,
  } as ModelGenerationRequest;
}

describe('AnthropicRequestMapper', () => {
  const m = new AnthropicRequestMapper();
  it('system separado das messages; papéis mapeados', () => {
    const out = m.map(req());
    expect(out.system).toContain('classifica leads');
    expect(out.messages[0].role).toBe('user');
    expect(out.model).toBe(MODEL);
    expect(out.max_tokens).toBe(512);
  });
  it('modelId fora da allowlist é rejeitado', () => {
    expect(() => m.map(req({ modelId: 'gpt-4' }))).toThrow();
  });
  it('outputSchema → tool sintética forçada (structured output)', () => {
    const out = m.map(req({ outputSchema: { type: 'object', properties: { grade: { type: 'string' } } } }));
    expect(out.tool_choice).toEqual({ type: 'tool', name: ANTHROPIC_STRUCTURED_OUTPUT_TOOL });
    expect(out.tools?.some((t) => t.name === ANTHROPIC_STRUCTURED_OUTPUT_TOOL)).toBe(true);
  });
  it('payload NÃO contém organizationId/credencial/baseURL/segredo', () => {
    const dump = JSON.stringify(m.map(req({ systemInstructions: 'ok' })));
    expect(dump.includes('organizationId')).toBe(false);
    expect(dump.includes('apiKey')).toBe(false);
    expect(dump.includes('api.anthropic.com')).toBe(false);
  });
});

describe('AnthropicResponseMapper', () => {
  const m = new AnthropicResponseMapper();
  const base = (over: Partial<AnthropicTransportResponse> = {}): AnthropicTransportResponse => ({
    id: 'msg_1', stop_reason: 'end_turn', content: [{ type: 'text', text: 'oi' }],
    usage: { input_tokens: 100, output_tokens: 16, cache_read_input_tokens: 20, cache_creation_input_tokens: 5 }, ...over,
  });
  it('structured output extraído da tool sintética', () => {
    const out = m.map(base({ stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 't1', name: ANTHROPIC_STRUCTURED_OUTPUT_TOOL, input: { grade: 'A' } }] }), MODEL);
    expect(out.structuredOutput).toEqual({ grade: 'A' });
    expect(out.toolCalls.length).toBe(0);
  });
  it('tool calls (não sintéticas) mapeadas para ModelToolCall', () => {
    const out = m.map(base({ stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 't2', name: 'reader', input: { q: 1 } }] }), MODEL);
    expect(out.toolCalls[0]).toEqual({ id: 't2', alias: 'reader', input: { q: 1 } });
  });
  it('usage: cache_read → cachedInputTokens; cache_creation NÃO é dobrado', () => {
    const out = m.map(base(), MODEL);
    expect(out.usage.inputTokens).toBe(100);
    expect(out.usage.outputTokens).toBe(16);
    expect(out.usage.cachedInputTokens).toBe(20); // só cache_read
  });
  it('finishReason table (VERIFIED)', () => {
    expect(mapAnthropicStopReason('end_turn')).toBe('STOP');
    expect(mapAnthropicStopReason('max_tokens')).toBe('MAX_TOKENS');
    expect(mapAnthropicStopReason('model_context_window_exceeded')).toBe('MAX_TOKENS');
    expect(mapAnthropicStopReason('tool_use')).toBe('TOOL_CALL');
    expect(mapAnthropicStopReason('refusal')).toBe('CONTENT_FILTER');
    expect(mapAnthropicStopReason(null)).toBe('ERROR');
  });
  it('providerRequestId fica no resultado (runtime persiste só hash)', () => {
    expect(m.map(base(), MODEL).providerRequestId).toBe('msg_1');
  });
});

describe('AnthropicErrorMapper', () => {
  const m = new AnthropicErrorMapper();
  it('rate limit → MODEL_RATE_LIMITED retryable, com Retry-After', () => {
    const r = m.map({ providerErrorClass: 'RateLimitError', httpStatus: 429, retryAfterMs: 2000 });
    expect(r.ardenCode).toBe('MODEL_RATE_LIMITED'); expect(r.retryable).toBe(true); expect(r.retryAfterMs).toBe(2000);
  });
  it('auth → MODEL_PROVIDER_ERROR não retryable', () => {
    expect(m.map({ providerErrorClass: 'AuthenticationError', httpStatus: 401 }).retryable).toBe(false);
  });
  it('timeout de conexão → AGENT_TIMEOUT retryable + unknown', () => {
    const r = m.map({ providerErrorClass: 'APIConnectionTimeoutError', httpStatus: null });
    expect(r.ardenCode).toBe('AGENT_TIMEOUT'); expect(r.unknown).toBe(true);
  });
  it('resposta malformada → MODEL_RESULT_UNKNOWN', () => {
    expect(m.map({ providerErrorClass: 'MalformedResponse', httpStatus: null }).ardenCode).toBe('MODEL_RESULT_UNKNOWN');
  });
  it('classe desconhecida → default MODEL_PROVIDER_ERROR + unknown', () => {
    const r = m.map({ providerErrorClass: 'WeirdError', httpStatus: null });
    expect(r.ardenCode).toBe('MODEL_PROVIDER_ERROR'); expect(r.unknown).toBe(true);
  });
});

describe('decideAnthropicRetry', () => {
  const em = new AnthropicErrorMapper();
  const rl = em.map({ providerErrorClass: 'RateLimitError', httpStatus: 429 });
  const auth = em.map({ providerErrorClass: 'AuthenticationError', httpStatus: 401 });
  // Timeout após envio: parece retryable (retryable=true) MAS é incerto (unknown=true)
  // → NÃO pode ser retriado automaticamente (risco semântico).
  const unknown = em.map({ providerErrorClass: 'APIConnectionTimeoutError', httpStatus: null });
  it('retryable dentro do teto e do deadline → retry', () => {
    expect(decideAnthropicRetry(rl, 1, ANTHROPIC_RETRY_DEFAULT, 60_000).retry).toBe(true);
  });
  it('não retryable → sem retry', () => {
    expect(decideAnthropicRetry(auth, 1, ANTHROPIC_RETRY_DEFAULT, 60_000).retry).toBe(false);
  });
  it('resultado incerto NUNCA é retriado automaticamente', () => {
    expect(decideAnthropicRetry(unknown, 1, ANTHROPIC_RETRY_DEFAULT, 60_000).reason).toBe('uncertain_result_not_retried');
  });
  it('excede teto de tentativas → sem retry', () => {
    expect(decideAnthropicRetry(rl, 3, ANTHROPIC_RETRY_DEFAULT, 60_000).retry).toBe(false);
  });
  it('deadline insuficiente → sem retry', () => {
    expect(decideAnthropicRetry(rl, 1, ANTHROPIC_RETRY_DEFAULT, 10).retry).toBe(false);
  });
});
