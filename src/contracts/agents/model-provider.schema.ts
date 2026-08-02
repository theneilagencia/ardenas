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
];

/** Projeção pura e validada do catálogo de providers. */
export function projectModelProviders(): ModelProviderDefinition[] {
  return MODEL_PROVIDER_DEFINITIONS.map((p) => modelProviderDefinition.parse(p));
}
