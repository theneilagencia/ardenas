/**
 * Arden.AS API — mapeamento de tool definitions canônicas → Anthropic (ARDEN-BE-008.5 §8/§10/§11).
 *
 * PURO. `ModelToolDefinition[]` (alias/description/inputSchema/riskLevel) → definições Anthropic
 * `{name, description, input_schema}` — SOMENTE esses três campos. NUNCA envia ao provider:
 * riskLevel, actionKey, authorization/approval policy, connectionId, organizationId, credencial,
 * endpoint, headers, rate limit, executor ou binding id (o tipo canônico nem carrega esses
 * campos — defesa em profundidade). Valida compatibilidade de schema (rejeita `$ref`/profundidade/
 * tamanho) e isola a descrição. Constrói o codec de nomes per-request (reversível).
 */

import type { ModelToolDefinition } from '@arden/contracts';
import { ModelProviderInvocationError } from '../../runtime/model-provider.errors';
import type { AnthropicTransportToolDefinition } from './anthropic-transport.types';
import { assertAnthropicSchemaCompatible } from './anthropic-schema-compatibility';
import { AnthropicToolNameCodec, AnthropicToolMappingError } from './anthropic-tool-name-codec';
import { AnthropicToolDescriptionGuard } from './anthropic-tool-description-guard';

/** Metadados sanitizados por tool mapeada (para evidência/auditoria — sem conteúdo bruto). */
export interface AnthropicMappedToolMeta {
  alias: string;
  providerName: string;
  schemaHash: string;
  descriptionHash: string;
  injectionSignals: string[];
}

export interface AnthropicToolDefinitionMapping {
  definitions: AnthropicTransportToolDefinition[];
  codec: AnthropicToolNameCodec;
  meta: AnthropicMappedToolMeta[];
}

import { createHash } from 'node:crypto';

export class AnthropicToolDefinitionMapper {
  private readonly descriptionGuard = new AnthropicToolDescriptionGuard();

  /**
   * @param tools ferramentas allowlisted (interseção server-side do 007.5).
   * @param reservedNames nomes reservados (ex.: tool sintética de structured output).
   */
  map(tools: readonly ModelToolDefinition[], reservedNames: readonly string[] = []): AnthropicToolDefinitionMapping {
    const codec = new AnthropicToolNameCodec(reservedNames);
    const definitions: AnthropicTransportToolDefinition[] = [];
    const meta: AnthropicMappedToolMeta[] = [];

    for (const tool of tools) {
      const inputSchema = (tool.inputSchema ?? {}) as Record<string, unknown>;
      // §10: compatibilidade de schema (nunca simplifica em silêncio → falha explícita).
      try {
        assertAnthropicSchemaCompatible(inputSchema);
      } catch (err) {
        if (err instanceof ModelProviderInvocationError) {
          throw new AnthropicToolMappingError('AGENT_TOOL_SCHEMA_INVALID', `Schema da tool "${tool.alias}" incompatível.`);
        }
        throw err;
      }
      // §11: isolamento da descrição (rejeita segredo; sinais de injeção não bloqueiam).
      const safe = this.descriptionGuard.sanitize(tool.alias, tool.description);
      const providerName = codec.register(tool.alias);
      definitions.push({ name: providerName, description: safe.description, input_schema: inputSchema });
      meta.push({
        alias: tool.alias,
        providerName,
        schemaHash: createHash('sha256').update(JSON.stringify(inputSchema)).digest('hex'),
        descriptionHash: safe.descriptionHash,
        injectionSignals: safe.injectionSignals,
      });
    }

    return { definitions, codec, meta };
  }
}
