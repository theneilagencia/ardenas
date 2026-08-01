/**
 * Arden.AS API — executores determinísticos internos (ARDEN-BE-005 §15/§16).
 *
 * Catálogo EXPLÍCITO de executores. Não há carregamento por nome vindo do banco,
 * `eval`, `new Function` nem import dinâmico por input livre. Cada executor é
 * determinístico e verificável; produz resultado real (sem mock aleatório) e
 * suporta cenários de sucesso e falha. NÃO são agentes e NÃO chamam nada externo.
 */

import type { EvidenceType, ExecutorActionKey } from '@arden/contracts';

export interface StepExecutionContext {
  organizationId: string;
  executionRunId: string;
  executionStepId: string;
  attemptNumber: number;
  input: unknown;
  definitionStepKey: string;
  /** Instante injetado — executores nunca leem o relógio. */
  now: Date;
}

export interface EvidenceDraft {
  evidenceType: EvidenceType;
  content: Record<string, unknown>;
}

export interface StepExecutionResult {
  output: unknown;
  /** Marca efeito persistido; usado para idempotência de retry. */
  effectApplied: boolean;
  evidence: EvidenceDraft[];
}

/** Erro de execução de etapa. `retryable` decide se o retry é agendado. */
export class StepExecutionError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = 'StepExecutionError';
  }
}

export interface StepExecutor {
  actionKey: ExecutorActionKey;
  execute(ctx: StepExecutionContext): Promise<StepExecutionResult>;
  /** Compensação semântica (opcional). Ausente = executor não compensa. */
  compensate?(ctx: StepExecutionContext): Promise<{ output: unknown }>;
}

function asRecord(input: unknown): Record<string, unknown> {
  return input && typeof input === 'object' && !Array.isArray(input) ? (input as Record<string, unknown>) : {};
}

/** Id estável derivado da etapa — retries produzem o mesmo id (determinismo). */
function stableId(prefix: string, ctx: StepExecutionContext): string {
  return `${prefix}_${ctx.executionStepId}`;
}

const executors: StepExecutor[] = [
  {
    actionKey: 'system.noop',
    async execute() {
      return { output: { ok: true }, effectApplied: false, evidence: [] };
    },
  },
  {
    actionKey: 'data.transform.static',
    async execute(ctx) {
      const input = asRecord(ctx.input);
      const transformed: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(input)) {
        transformed[k] = typeof v === 'string' ? v.trim().toUpperCase() : v;
      }
      return { output: { transformed }, effectApplied: false, evidence: [{ evidenceType: 'OUTPUT', content: { transformed } }] };
    },
  },
  {
    actionKey: 'data.validate.schema',
    async execute(ctx) {
      const input = asRecord(ctx.input);
      const required = Array.isArray(input.requiredFields) ? (input.requiredFields as unknown[]) : [];
      const missing = required.filter((f) => typeof f === 'string' && !(f in input));
      if (missing.length > 0) {
        throw new StepExecutionError('STEP_INPUT_INVALID', `Campos ausentes: ${missing.join(', ')}`, false);
      }
      return { output: { valid: true }, effectApplied: false, evidence: [{ evidenceType: 'DECISION', content: { valid: true } }] };
    },
  },
  {
    actionKey: 'record.create.internal',
    async execute(ctx) {
      const recordId = stableId('rec', ctx);
      return { output: { recordId, created: true }, effectApplied: true, evidence: [{ evidenceType: 'OUTPUT', content: { recordId } }] };
    },
    async compensate(ctx) {
      return { output: { recordId: stableId('rec', ctx), reverted: true } };
    },
  },
  {
    actionKey: 'record.update.internal',
    async execute(ctx) {
      return { output: { recordId: stableId('rec', ctx), updated: true }, effectApplied: true, evidence: [{ evidenceType: 'OUTPUT', content: { updated: true } }] };
    },
    async compensate(ctx) {
      return { output: { recordId: stableId('rec', ctx), reverted: true } };
    },
  },
  {
    actionKey: 'decision.evaluate.static',
    async execute(ctx) {
      const input = asRecord(ctx.input);
      const decision = typeof input.decision === 'string' ? input.decision : 'APPROVED';
      return { output: { decision }, effectApplied: false, evidence: [{ evidenceType: 'DECISION', content: { decision } }] };
    },
  },
  {
    actionKey: 'evidence.record',
    async execute(ctx) {
      const input = asRecord(ctx.input);
      return { output: { recorded: true }, effectApplied: false, evidence: [{ evidenceType: 'OUTPUT', content: { note: input.note ?? null } }] };
    },
  },
  {
    actionKey: 'delay.simulated',
    async execute(ctx) {
      // Determinístico: NÃO usa setTimeout como mecanismo de execução. Apenas
      // registra a intenção de atraso — o worker não bloqueia.
      const input = asRecord(ctx.input);
      const delayMs = typeof input.delayMs === 'number' ? input.delayMs : 0;
      return { output: { simulatedDelayMs: delayMs }, effectApplied: false, evidence: [] };
    },
  },
  {
    actionKey: 'failure.deterministic',
    async execute(ctx) {
      const input = asRecord(ctx.input);
      // alwaysFail → falha não-retryable; failUntilAttempt=N → falha (retryable) até
      // a tentativa N, depois sucede. Totalmente determinístico por attemptNumber.
      if (input.alwaysFail === true) {
        throw new StepExecutionError('STEP_FAILED', 'Falha determinística permanente.', false);
      }
      const failUntil = typeof input.failUntilAttempt === 'number' ? input.failUntilAttempt : 0;
      if (ctx.attemptNumber <= failUntil) {
        throw new StepExecutionError('STEP_FAILED', `Falha determinística na tentativa ${ctx.attemptNumber}.`, true);
      }
      return { output: { recovered: true, attempt: ctx.attemptNumber }, effectApplied: false, evidence: [] };
    },
  },
];

const REGISTRY = new Map<string, StepExecutor>(executors.map((e) => [e.actionKey, e]));

export function hasExecutor(actionKey: string): boolean {
  return REGISTRY.has(actionKey);
}

/** Resolve o executor; ausência é erro tipado (nunca carrega código arbitrário). */
export function getExecutor(actionKey: string): StepExecutor {
  const executor = REGISTRY.get(actionKey);
  if (!executor) throw new StepExecutionError('STEP_EXECUTOR_NOT_AVAILABLE', `Executor não registrado: ${actionKey}`, false);
  return executor;
}

export const ALL_EXECUTOR_KEYS: ExecutorActionKey[] = executors.map((e) => e.actionKey);
