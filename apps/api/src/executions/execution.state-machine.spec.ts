/**
 * Arden.AS API — testes da máquina de estados e executores (ARDEN-BE-005).
 */

import { describe, expect, it } from 'vitest';
import { canTransition, isTerminal, TERMINAL_STATUSES } from './execution.state-machine';
import { getExecutor, hasExecutor, StepExecutionError, ALL_EXECUTOR_KEYS, type StepExecutionContext } from './executors';

function ctx(overrides: Partial<StepExecutionContext> = {}): StepExecutionContext {
  return {
    organizationId: 'org', executionRunId: 'run', executionStepId: 'step', attemptNumber: 1,
    input: {}, definitionStepKey: 'k', now: new Date('2026-08-01T00:00:00Z'), ...overrides,
  };
}

describe('máquina de estados', () => {
  it('permite transições válidas', () => {
    expect(canTransition('PENDING', 'QUEUED')).toBe(true);
    expect(canTransition('QUEUED', 'RUNNING')).toBe(true);
    expect(canTransition('RUNNING', 'SUCCEEDED')).toBe(true);
    expect(canTransition('RUNNING', 'PAUSE_REQUESTED')).toBe(true);
    expect(canTransition('PAUSED', 'RESUME_REQUESTED')).toBe(true);
    expect(canTransition('FAILED', 'COMPENSATING')).toBe(true);
    expect(canTransition('FAILED', 'QUEUED')).toBe(true);
    expect(canTransition('CANCEL_REQUESTED', 'CANCELLED')).toBe(true);
  });
  it('rejeita transições inválidas', () => {
    expect(canTransition('SUCCEEDED', 'RUNNING')).toBe(false);
    expect(canTransition('PENDING', 'SUCCEEDED')).toBe(false);
    expect(canTransition('CANCELLED', 'QUEUED')).toBe(false);
    expect(canTransition('RUNNING', 'PAUSED')).toBe(false); // via PAUSE_REQUESTED
  });
  it('reconhece estados terminais', () => {
    expect(isTerminal('SUCCEEDED')).toBe(true);
    expect(isTerminal('CANCELLED')).toBe(true);
    expect(isTerminal('RUNNING')).toBe(false);
    for (const t of TERMINAL_STATUSES) expect(canTransition(t, 'QUEUED')).toBe(false);
  });
});

describe('executores determinísticos', () => {
  it('registra exatamente os executores permitidos', () => {
    expect(ALL_EXECUTOR_KEYS).toContain('system.noop');
    expect(ALL_EXECUTOR_KEYS).toContain('failure.deterministic');
    expect(hasExecutor('system.noop')).toBe(true);
    expect(hasExecutor('http.call.external')).toBe(false);
  });
  it('executor ausente é erro tipado (nunca carrega código arbitrário)', () => {
    expect(() => getExecutor('anything')).toThrow(StepExecutionError);
  });
  it('system.noop sucede', async () => {
    const r = await getExecutor('system.noop').execute(ctx());
    expect(r.output).toEqual({ ok: true });
  });
  it('data.validate.schema falha (não-retryable) com campo ausente', async () => {
    try {
      await getExecutor('data.validate.schema').execute(ctx({ input: { requiredFields: ['x'] } }));
      throw new Error('deveria falhar');
    } catch (e) {
      expect(e).toBeInstanceOf(StepExecutionError);
      expect((e as StepExecutionError).retryable).toBe(false);
    }
  });
  it('failure.deterministic falha até failUntilAttempt e depois sucede', async () => {
    const executor = getExecutor('failure.deterministic');
    await expect(executor.execute(ctx({ attemptNumber: 1, input: { failUntilAttempt: 1 } }))).rejects.toBeInstanceOf(StepExecutionError);
    const ok = await executor.execute(ctx({ attemptNumber: 2, input: { failUntilAttempt: 1 } }));
    expect(ok.output).toMatchObject({ recovered: true });
  });
  it('failure.deterministic alwaysFail é não-retryable', async () => {
    try {
      await getExecutor('failure.deterministic').execute(ctx({ input: { alwaysFail: true } }));
      throw new Error('deveria falhar');
    } catch (e) {
      expect((e as StepExecutionError).retryable).toBe(false);
    }
  });
  it('record.create.internal é determinístico e compensável', async () => {
    const executor = getExecutor('record.create.internal');
    const a = await executor.execute(ctx());
    const b = await executor.execute(ctx());
    expect(a.output).toEqual(b.output); // mesmo id → idempotente
    expect(a.effectApplied).toBe(true);
    expect(executor.compensate).toBeDefined();
  });
});
