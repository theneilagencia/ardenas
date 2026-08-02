/**
 * Arden.AS API — testes da classificação de retry/UNKNOWN (ARDEN-BE-006.6).
 */

import { describe, expect, it } from 'vitest';
import { classifyError, classifyResponse, isIdempotent } from './retry-classifier';

describe('isIdempotent', () => {
  it('GET/PUT/DELETE sempre idempotentes', () => {
    expect(isIdempotent('GET', 'NONE')).toBe(true);
    expect(isIdempotent('PUT', 'NONE')).toBe(true);
    expect(isIdempotent('DELETE', 'NONE')).toBe(true);
  });
  it('POST idempotente só com chave', () => {
    expect(isIdempotent('POST', 'NONE')).toBe(false);
    expect(isIdempotent('POST', 'REQUIRED')).toBe(true);
    expect(isIdempotent('POST', 'PROVIDER_NATIVE')).toBe(true);
  });
});

describe('classifyResponse', () => {
  it('2xx ⇒ SUCCEEDED', () => {
    expect(classifyResponse(200, 'GET', 'NONE', 'CONDITIONAL')).toMatchObject({ status: 'SUCCEEDED', retryable: false });
  });
  it('429 ⇒ retry condicional com Retry-After', () => {
    const c = classifyResponse(429, 'POST', 'REQUIRED', 'SAFE', 2000);
    expect(c).toMatchObject({ status: 'FAILED', retryable: true, errorCode: 'EXTERNAL_RATE_LIMITED', retryAfterMs: 2000 });
  });
  it('429 com retryMode NEVER ⇒ sem retry', () => {
    expect(classifyResponse(429, 'GET', 'NONE', 'NEVER').retryable).toBe(false);
  });
  it('5xx idempotente CONDITIONAL ⇒ retry', () => {
    expect(classifyResponse(503, 'GET', 'NONE', 'CONDITIONAL').retryable).toBe(true);
  });
  it('5xx POST NONE CONDITIONAL ⇒ sem retry (não idempotente)', () => {
    expect(classifyResponse(503, 'POST', 'NONE', 'CONDITIONAL').retryable).toBe(false);
  });
  it('5xx SAFE ⇒ retry mesmo não idempotente', () => {
    expect(classifyResponse(503, 'POST', 'NONE', 'SAFE').retryable).toBe(true);
  });
  it('4xx (não 429) ⇒ falha definitiva', () => {
    expect(classifyResponse(400, 'GET', 'NONE', 'SAFE')).toMatchObject({ status: 'FAILED', retryable: false });
  });
});

describe('classifyError', () => {
  it('SSRF/política ⇒ falha definitiva sem retry', () => {
    expect(classifyError('SSRF_BLOCKED', 'x', 'GET', 'NONE', 'SAFE')).toMatchObject({ status: 'FAILED', retryable: false });
    expect(classifyError('NETWORK_POLICY_DENIED', 'x', 'GET', 'NONE', 'SAFE').retryable).toBe(false);
  });
  it('credential revoked ⇒ sem retry', () => {
    expect(classifyError('CREDENTIAL_REVOKED', 'x', 'GET', 'NONE', 'SAFE').retryable).toBe(false);
  });
  it('timeout idempotente ⇒ FAILED retryável (por retryMode)', () => {
    expect(classifyError('EXTERNAL_TIMEOUT', 'x', 'GET', 'NONE', 'SAFE')).toMatchObject({ status: 'FAILED', retryable: true });
  });
  it('timeout POST NONE ⇒ UNKNOWN sem retry', () => {
    expect(classifyError('EXTERNAL_TIMEOUT', 'x', 'POST', 'NONE', 'SAFE')).toMatchObject({ status: 'UNKNOWN', retryable: false, errorCode: 'EXTERNAL_RESULT_UNKNOWN' });
  });
  it('provider error POST NONE ⇒ UNKNOWN (ambíguo)', () => {
    expect(classifyError('EXTERNAL_PROVIDER_ERROR', 'x', 'POST', 'NONE', 'CONDITIONAL')).toMatchObject({ status: 'UNKNOWN', retryable: false });
  });
  it('response too large ⇒ falha determinística sem retry', () => {
    expect(classifyError('RESPONSE_TOO_LARGE', 'x', 'GET', 'NONE', 'SAFE').retryable).toBe(false);
  });
  it('timeout PUT REQUIRED ⇒ retryável', () => {
    expect(classifyError('EXTERNAL_TIMEOUT', 'x', 'PUT', 'REQUIRED', 'CONDITIONAL')).toMatchObject({ status: 'FAILED', retryable: true });
  });
});
