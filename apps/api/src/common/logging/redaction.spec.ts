import { describe, expect, it } from 'vitest';
import { REDACT_PATHS } from '../constants';

describe('política de redaction dos logs', () => {
  it('oculta Authorization, cookies e tokens', () => {
    expect(REDACT_PATHS).toContain('req.headers.authorization');
    expect(REDACT_PATHS).toContain('req.headers.cookie');
    expect(REDACT_PATHS.some((p) => p.includes('token'))).toBe(true);
    expect(REDACT_PATHS.some((p) => p.includes('secret'))).toBe(true);
  });
});
