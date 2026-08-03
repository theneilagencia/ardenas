/**
 * Arden.AS — chaves canônicas do provider Anthropic (ARDEN-BE-008.1).
 *
 * CONTRACT_ONLY: o provider ainda NÃO é executável. Chaves distinguem a API DIRETA
 * da Anthropic de futuros caminhos (Bedrock/Vertex/gateway). Verificado do pacote
 * oficial `@anthropic-ai/sdk@0.115.0` (ver ANTHROPIC_OFFICIAL_SOURCE_REGISTER.md).
 * Nenhum tipo de SDK aqui; nenhum segredo; nenhum endpoint arbitrário.
 */

/** Provider de modelo (API direta da Anthropic). */
export const ANTHROPIC_PROVIDER_KEY = 'anthropic.direct' as const;
export const ANTHROPIC_PROVIDER_VERSION = '1' as const;

/** Connector de credencial (cofre BE-006) — separado do provider de modelo. */
export const ANTHROPIC_CONNECTOR_KEY = 'system.anthropic' as const;

/** Base URL oficial (VERIFIED, default do SDK). Override arbitrário é proibido. */
export const ANTHROPIC_OFFICIAL_BASE_URL = 'https://api.anthropic.com' as const;

/**
 * Estado de implementação do provider — evita que apareça como utilizável antes da
 * fase executável. Derivável do catálogo; nenhuma projeção no banco nesta fase.
 */
export type ProviderImplementationStatus = 'CONTRACT_ONLY' | 'CONFIGURABLE' | 'EXECUTABLE' | 'DISABLED';
export const ANTHROPIC_IMPLEMENTATION_STATUS: ProviderImplementationStatus = 'CONTRACT_ONLY';

/**
 * ModelProviderDefinition do Anthropic como CONTRATO (não projetado no banco em
 * 008.1). `status: DISABLED` + `productionAllowed: false` garantem não-executável.
 * Projeção fica para o 008.2. Capabilities do primeiro slice: STRUCTURED_OUTPUT.
 */
export const ANTHROPIC_PROVIDER_DEFINITION_CONTRACT = {
  key: ANTHROPIC_PROVIDER_KEY,
  version: ANTHROPIC_PROVIDER_VERSION,
  name: 'Anthropic Claude',
  description: 'Claude via API direta da Anthropic (contrato; ainda não executável).',
  status: 'DISABLED' as const,
  productionAllowed: false as const,
  systemManaged: true as const,
  capabilities: ['STRUCTURED_OUTPUT'] as const,
  implementationStatus: ANTHROPIC_IMPLEMENTATION_STATUS,
} as const;
