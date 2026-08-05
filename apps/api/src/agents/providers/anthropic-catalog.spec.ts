/**
 * Arden.AS API — testes unitários do catálogo Anthropic persistido (ARDEN-BE-008.2 §41).
 *
 * Conector system.anthropic (MODEL_PROVIDER, sem tools, credencial write-only), provider
 * anthropic.direct DISABLED, modelos DISABLED, ausência de rate card comercial, e validação
 * estrita de ModelConfiguration Anthropic. Sem DB, sem rede, sem SDK, sem segredo.
 */

import { describe, expect, it } from 'vitest';
import {
  CONNECTOR_DEFINITIONS,
  CONNECTOR_TOOLS,
  MODEL_PROVIDER_DEFINITIONS,
  ANTHROPIC_MODEL_CATALOG,
  projectRateCards,
} from '@arden/contracts';
import { AnthropicConfigurationValidationService } from '../model-configurations/anthropic-configuration-validation.service';

describe('Anthropic — conector system.anthropic no catálogo', () => {
  const def = CONNECTOR_DEFINITIONS.find((c) => c.key === 'system.anthropic');
  it('existe, categoria MODEL_PROVIDER, system-managed, ACTIVE', () => {
    expect(def).toBeDefined();
    expect(def!.category).toBe('MODEL_PROVIDER');
    expect(def!.systemManaged).toBe(true);
    expect(def!.status).toBe('ACTIVE');
  });
  it('credencial write-only (apiKey) e config com base URL travada em OFFICIAL', () => {
    const cred = def!.credentialSchema as Record<string, { writeOnly?: boolean }>;
    expect((cred.properties as Record<string, { writeOnly?: boolean }>).apiKey.writeOnly).toBe(true);
    const cfg = def!.configurationSchema as { properties: { baseUrlMode: { enum: string[] } } };
    expect(cfg.properties.baseUrlMode.enum).toEqual(['OFFICIAL']);
  });
  it('NÃO expõe ferramenta de geração (sem tools)', () => {
    expect(CONNECTOR_TOOLS.filter((t) => t.connectorKey === 'system.anthropic')).toHaveLength(0);
    expect(def!.capabilityKeys).toHaveLength(0);
  });
});

describe('Anthropic — provider e modelos DISABLED', () => {
  it('anthropic.direct catalogado DISABLED / productionAllowed=false', () => {
    const p = MODEL_PROVIDER_DEFINITIONS.find((m) => m.key === 'anthropic.direct');
    expect(p).toBeDefined();
    expect(p!.status).toBe('DISABLED');
    expect(p!.productionAllowed).toBe(false);
    expect(p!.capabilities).toEqual(['STRUCTURED_OUTPUT']);
  });
  it('todos os modelos do catálogo Anthropic são DISABLED e datados', () => {
    expect(ANTHROPIC_MODEL_CATALOG.length).toBeGreaterThan(0);
    for (const m of ANTHROPIC_MODEL_CATALOG) {
      expect(m.status).toBe('DISABLED');
      expect(m.productionAllowed).toBe(false);
      expect(/\d{8}$/.test(m.modelId)).toBe(true);
      expect(m.rateCardKey).toBeNull();
    }
  });
  it('NENHUM rate card comercial Anthropic é projetado (preço UNVERIFIED)', () => {
    const anthropicCards = projectRateCards().filter((c) => c.providerKey === 'anthropic.direct');
    expect(anthropicCards).toHaveLength(0);
  });
});

describe('AnthropicConfigurationValidationService', () => {
  const svc = new AnthropicConfigurationValidationService();
  const modelId = ANTHROPIC_MODEL_CATALOG[0].modelId;

  it('no-op para providers não Anthropic', () => {
    expect(() => svc.validate('internal.test-model', 'qualquer', { foo: 1 })).not.toThrow();
  });
  it('aceita parâmetros válidos e modelId allowlisted', () => {
    expect(() => svc.validate('anthropic.direct', modelId, { maximumOutputTokens: 512, temperature: 0.2 })).not.toThrow();
  });
  it('rejeita modelId fora da allowlist', () => {
    expect(() => svc.validate('anthropic.direct', 'gpt-4', { maximumOutputTokens: 512 })).toThrow();
    expect(() => svc.validate('anthropic.direct', 'claude-not-real', { maximumOutputTokens: 512 })).toThrow();
  });
  it('rejeita parâmetros proibidos (apiKey/baseUrl/model/headers)', () => {
    for (const bad of [{ apiKey: 'x' }, { baseUrl: 'https://evil' }, { model: 'claude' }, { headers: {} }, { timeout: 999999 }]) {
      expect(() => svc.validate('anthropic.direct', modelId, { maximumOutputTokens: 512, ...bad })).toThrow();
    }
  });
  it('rejeita ausência de maximumOutputTokens', () => {
    expect(() => svc.validate('anthropic.direct', modelId, {})).toThrow();
  });
});
