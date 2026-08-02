/**
 * Arden.AS API — provider de modelo DETERMINÍSTICO interno (ARDEN-BE-007.3 §9/§10).
 *
 * `internal.test-model@1`. SEM SDK, SEM internet, SEM segredo, SEM relógio real. Os
 * cenários são escolhidos por `modelId` de uma ALLOWLIST fechada — nunca por payload
 * público arbitrário. `productionAllowed=false`: o runtime não o executa em produção.
 * Structured output é gerado a partir do `outputSchema` da versão. Repair é sinalizado
 * por uma mensagem de correção que o runtime acrescenta (determinístico, sem estado).
 */

import { Injectable } from '@nestjs/common';
import type { ModelGenerationRequest, ModelGenerationResult, ModelMessage } from '@arden/contracts';
import type { ModelProvider } from '@arden/contracts';
import { ModelProviderInvocationError } from './model-provider.errors';
import { estimateTokens } from './token-estimator';

export const INTERNAL_TEST_PROVIDER_KEY = 'internal.test-model';
export const INTERNAL_TEST_PROVIDER_VERSION = '1';

/** Marca acrescentada pelo runtime a uma mensagem de correção de repair. */
export const REPAIR_MARKER = '[arden:repair]';

/** Model IDs determinísticos permitidos (proibidos em produção). */
export const INTERNAL_TEST_MODEL_IDS = [
  'test/structured-success',
  'test/structured-invalid',
  'test/structured-repairable',
  'test/timeout',
  'test/rate-limit',
  'test/provider-error',
  'test/content-filtered',
  'test/unknown-result',
] as const;
export type InternalTestModelId = (typeof INTERNAL_TEST_MODEL_IDS)[number];

export function isInternalTestModelId(modelId: string): boolean {
  return (INTERNAL_TEST_MODEL_IDS as readonly string[]).includes(modelId);
}

/** Gera um valor MÍNIMO que satisfaz o `outputSchema` (walk determinístico do schema). */
export function buildValidOutput(schema: Record<string, unknown> | undefined): unknown {
  if (!schema || Object.keys(schema).length === 0) return {};
  const type = Array.isArray(schema.type) ? (schema.type as string[])[0] : (schema.type as string | undefined);
  if (type === 'object' || schema.properties) {
    const props = (schema.properties as Record<string, Record<string, unknown>> | undefined) ?? {};
    const required = Array.isArray(schema.required) ? (schema.required as string[]) : Object.keys(props);
    const out: Record<string, unknown> = {};
    for (const key of required) out[key] = buildValidOutput(props[key] ?? { type: 'string' });
    return out;
  }
  if (type === 'array') return [];
  if (type === 'number' || type === 'integer') return 0;
  if (type === 'boolean') return true;
  if (Array.isArray(schema.enum) && (schema.enum as unknown[]).length > 0) return (schema.enum as unknown[])[0];
  return 'ok';
}

function hasRepairSignal(messages: ModelMessage[]): boolean {
  return messages.some((m) =>
    m.content.some((c) => typeof c.text === 'string' && c.text.includes(REPAIR_MARKER)),
  );
}

function usageFor(request: ModelGenerationRequest, outputTokens: number): ModelGenerationResult['usage'] {
  const inputTokens = estimateTokens(request.systemInstructions) + estimateTokens(request.messages);
  return {
    providerKey: request.providerKey,
    modelId: request.modelId,
    inputTokens,
    outputTokens,
    cachedInputTokens: 0,
    cachedOutputTokens: 0,
    toolCallCount: 0,
    modelCallCount: 1,
    durationMs: 0,
    estimatedCostMinor: null,
    currency: null,
  };
}

@Injectable()
export class InternalTestModelProvider implements ModelProvider {
  readonly key = INTERNAL_TEST_PROVIDER_KEY;
  readonly version = INTERNAL_TEST_PROVIDER_VERSION;

  async generate(request: ModelGenerationRequest): Promise<ModelGenerationResult> {
    // Sem tools nesta fase — nunca produz tool calls.
    const modelId = request.modelId;
    if (!isInternalTestModelId(modelId)) {
      throw new ModelProviderInvocationError('UNSUPPORTED_MODEL', `modelId fora da allowlist do provider de teste: ${modelId}.`);
    }

    switch (modelId as InternalTestModelId) {
      case 'test/structured-success':
        return { finishReason: 'STOP', structuredOutput: buildValidOutput(request.outputSchema), toolCalls: [], usage: usageFor(request, 16) };
      case 'test/structured-invalid':
        // Output propositalmente inválido contra o schema (sem os campos obrigatórios).
        return { finishReason: 'STOP', structuredOutput: { __invalid: true }, toolCalls: [], usage: usageFor(request, 8) };
      case 'test/structured-repairable':
        return hasRepairSignal(request.messages)
          ? { finishReason: 'STOP', structuredOutput: buildValidOutput(request.outputSchema), toolCalls: [], usage: usageFor(request, 16) }
          : { finishReason: 'STOP', structuredOutput: { __invalid: true }, toolCalls: [], usage: usageFor(request, 8) };
      case 'test/content-filtered':
        return { finishReason: 'CONTENT_FILTER', toolCalls: [], usage: usageFor(request, 0) };
      case 'test/timeout':
        throw new ModelProviderInvocationError('TIMEOUT', 'Tempo limite simulado do provider de teste.');
      case 'test/rate-limit':
        throw new ModelProviderInvocationError('RATE_LIMIT', 'Rate limit simulado do provider de teste.');
      case 'test/provider-error':
        throw new ModelProviderInvocationError('PROVIDER_ERROR', 'Erro simulado do provider de teste.');
      case 'test/unknown-result':
        throw new ModelProviderInvocationError('UNKNOWN', 'Resultado incerto simulado do provider de teste.');
    }
  }
}
