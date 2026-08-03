/**
 * Arden.AS API — compatibilidade do outputSchema com o structured output Anthropic
 * (ARDEN-BE-008.3 §25). PURO. Recusa features não suportadas ANTES da chamada: `$ref`
 * (schema externo/remoto), profundidade excessiva, propriedades/tamanho excessivos. Nunca
 * simplifica silenciosamente um schema incompatível — falha explícita.
 */

import { ModelProviderInvocationError } from '../../runtime/model-provider.errors';

const MAX_DEPTH = 12;
const MAX_PROPERTIES = 200;
const MAX_SERIALIZED_BYTES = 100_000;

export function assertAnthropicSchemaCompatible(schema: Record<string, unknown>): void {
  const serialized = JSON.stringify(schema);
  if (serialized.length > MAX_SERIALIZED_BYTES) {
    throw new ModelProviderInvocationError('PROVIDER_ERROR', 'Schema de saída excede o tamanho suportado.');
  }
  let propertyCount = 0;

  const walk = (node: unknown, depth: number): void => {
    if (depth > MAX_DEPTH) throw new ModelProviderInvocationError('PROVIDER_ERROR', 'Schema de saída excede a profundidade suportada.');
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      for (const item of node) walk(item, depth + 1);
      return;
    }
    const obj = node as Record<string, unknown>;
    // $ref (referência externa/remota) não é suportado — sem resolução de schema remoto.
    if ('$ref' in obj) throw new ModelProviderInvocationError('PROVIDER_ERROR', 'Schema de saída com $ref não é suportado.');
    if (obj.properties && typeof obj.properties === 'object') {
      propertyCount += Object.keys(obj.properties as Record<string, unknown>).length;
      if (propertyCount > MAX_PROPERTIES) throw new ModelProviderInvocationError('PROVIDER_ERROR', 'Schema de saída excede o número de propriedades suportado.');
    }
    for (const value of Object.values(obj)) walk(value, depth + 1);
  };

  walk(schema, 0);
}
