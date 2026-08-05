/**
 * Arden.AS — API v1 · providers de modelo (ARDEN-BE-007.1).
 *
 * O provider é INFRAESTRUTURA SUBSTITUÍVEL. Nesta fase há apenas a definição canônica
 * e um provider de TESTE determinístico (`internal.test-model`) — sem SDK, sem
 * internet, sem catálogo extenso. Providers reais entram em fases futuras. A resposta
 * é pública (não tenant-scoped) e nunca carrega segredo.
 */

import { z } from 'zod';
import {
  modelProviderKey,
  modelProviderVersion,
  modelProviderStatus,
  modelProviderCapability,
  modelId,
} from './agent-keys';

export const modelProviderDefinition = z.object({
  key: modelProviderKey,
  version: modelProviderVersion,
  name: z.string().min(1).max(120),
  description: z.string().max(500).nullable().optional(),
  status: modelProviderStatus,
  capabilities: z.array(modelProviderCapability).max(5),
  /** Se pode ser usado em produção (o provider de teste NÃO pode). */
  productionAllowed: z.boolean(),
  /** Provider gerido pela plataforma (system-managed), não pelo tenant. */
  systemManaged: z.boolean(),
});
export type ModelProviderDefinition = z.infer<typeof modelProviderDefinition>;

/**
 * Catálogo canônico INICIAL (fechado). Apenas o provider de teste determinístico —
 * `productionAllowed=false`, sem internet, resultado/estruturado/tool/erro/timeout
 * controlados. O RUNTIME não é implementado nesta fase.
 */
export const MODEL_PROVIDER_DEFINITIONS: readonly ModelProviderDefinition[] = [
  {
    key: 'internal.test-model',
    version: '1',
    name: 'Provider de teste determinístico',
    description:
      'Provider interno para contratos e testes. Sem SDK, sem internet. Resultado, saída ' +
      'estruturada, tool call, erro e timeout são determinísticos. Proibido em produção.',
    status: 'ACTIVE',
    capabilities: ['STRUCTURED_OUTPUT', 'TOOL_CALLING'],
    productionAllowed: false,
    systemManaged: true,
  },
  {
    // ARDEN-BE-008.2: Anthropic via API direta, persistido como DISABLED / não executável
    // (CONTRACT_ONLY). NÃO registrado no ModelProviderRegistry; verificação oficial de
    // preço/governança pendente (008.2A = UNVERIFIED). Não muda para ACTIVE nesta fase.
    key: 'anthropic.direct',
    version: '1',
    name: 'Anthropic (API direta)',
    description:
      'Provider comercial Anthropic Claude via API direta. Contrato apenas nesta fase ' +
      '(DISABLED, productionAllowed=false): sem SDK, sem chamada real, sem runtime registrado.',
    status: 'DISABLED',
    capabilities: ['STRUCTURED_OUTPUT'],
    productionAllowed: false,
    systemManaged: true,
  },
];

/** Projeção pura e validada do catálogo de providers. */
export function projectModelProviders(): ModelProviderDefinition[] {
  return MODEL_PROVIDER_DEFINITIONS.map((p) => modelProviderDefinition.parse(p));
}

/**
 * Entrada de CATÁLOGO DE MODELOS persistida (ARDEN-BE-008.2 §21), leitura pública/
 * system-scoped. Metadados apenas — nunca segredo, nunca preço. Modelos comerciais
 * (ex.: Anthropic) permanecem `DISABLED` / `productionAllowed=false` enquanto pendentes.
 * `maximumInputTokens`/`maximumOutputTokens` são `null` quando não verificados oficialmente.
 */
export const modelCatalogEntry = z.object({
  providerKey: modelProviderKey,
  providerVersion: modelProviderVersion,
  modelId,
  displayName: z.string().min(1).max(120),
  status: modelProviderStatus,
  productionAllowed: z.boolean(),
  capabilities: z.array(modelProviderCapability).max(5),
  maximumInputTokens: z.number().int().positive().nullable(),
  maximumOutputTokens: z.number().int().positive().nullable(),
  supportsStructuredOutput: z.boolean(),
  supportsToolCalling: z.boolean(),
  supportsPromptCaching: z.boolean(),
  supportsVision: z.boolean(),
  supportsStreaming: z.boolean(),
  rateCardKey: z.string().max(120).nullable(),
  sourceReferences: z.array(z.string().min(1).max(300)),
});
export type ModelCatalogEntry = z.infer<typeof modelCatalogEntry>;
