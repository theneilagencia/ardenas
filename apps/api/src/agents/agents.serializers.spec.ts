/**
 * Arden.AS API — testes dos mappers do runtime de agentes (ARDEN-BE-007.2).
 * Fronteira de segurança: nenhuma resposta expõe segredo, credencial, contentHash
 * interno ou providerDefinitionId. Datas viram ISO.
 */

import { describe, expect, it } from 'vitest';
import {
  toAgentDefinitionContract,
  toAgentVersionContract,
  toModelConfigurationContract,
  toModelProviderContract,
} from './agents.serializers';

const CANARY = 'ARDEN_BE007_PERSISTENCE_SECRET_CANARY';
const now = new Date('2026-08-02T00:00:00.000Z');

describe('mappers — fronteira de segurança', () => {
  it('AgentDefinition não expõe segredo', () => {
    const out = toAgentDefinitionContract({
      id: 'a1', organizationId: 'o1', key: 'k', name: 'n', description: null, status: 'DRAFT',
      currentPublishedVersionId: null, createdByUserId: 'u1', revision: 1, createdAt: now, updatedAt: now,
    } as never);
    expect(JSON.stringify(out).includes(CANARY)).toBe(false);
    expect(out.createdAt).toBe(now.toISOString());
  });

  it('AgentVersion não expõe contentHash interno nem segredo', () => {
    const out = toAgentVersionContract({
      id: 'v1', organizationId: 'o1', agentDefinitionId: 'a1', versionNumber: 1, status: 'DRAFT',
      objective: 'x', systemInstructions: 'y', modelConfigurationId: 'c1', inputSchema: {}, outputSchema: {},
      contextPolicy: {}, executionPolicy: {}, toolPolicy: {}, evaluationPolicy: {}, costPolicy: {},
      contentHash: 'SECRET_HASH', createdByUserId: 'u1', revision: 1, createdAt: now, updatedAt: now,
      publishedAt: null, retiredAt: null,
    } as never);
    expect(Object.keys(out)).not.toContain('contentHash');
    expect(JSON.stringify(out).includes('SECRET_HASH')).toBe(false);
  });

  it('ModelConfiguration não expõe credencial nem providerDefinitionId; usa providerKey/version', () => {
    const out = toModelConfigurationContract(
      {
        id: 'c1', organizationId: 'o1', providerDefinitionId: 'pdef_internal', name: 'n', description: null,
        modelId: 'm', credentialConnectionId: 'conn1', parameters: { maximumOutputTokens: 100 }, status: 'DRAFT',
        createdByUserId: 'u1', revision: 1, createdAt: now, updatedAt: now,
      } as never,
      { key: 'internal.test-model', version: '1' },
    );
    const keys = Object.keys(out);
    expect(keys).not.toContain('providerDefinitionId');
    for (const k of ['secret', 'apiKey', 'credential', 'encryptedSecret']) expect(keys).not.toContain(k);
    expect(out.providerKey).toBe('internal.test-model');
    // credentialConnectionId (referência ao cofre) é permitido; o segredo nunca.
    expect(out.credentialConnectionId).toBe('conn1');
  });

  it('ModelProviderDefinition não expõe id interno', () => {
    const out = toModelProviderContract({
      id: 'pdef_internal', key: 'internal.test-model', version: '1', name: 'n', description: null,
      status: 'ACTIVE', capabilities: ['STRUCTURED_OUTPUT'], productionAllowed: false, systemManaged: true,
      catalogHash: 'h', createdAt: now, updatedAt: now,
    } as never);
    expect(Object.keys(out)).not.toContain('id');
    expect(out.productionAllowed).toBe(false);
  });
});
