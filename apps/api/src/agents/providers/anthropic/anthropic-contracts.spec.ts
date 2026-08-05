/**
 * Arden.AS API — testes contratuais do provider Anthropic (ARDEN-BE-008.1).
 * Chaves únicas, catálogo allowlisted, fontes presentes, capabilities coerentes,
 * limites válidos, rate cards precisos (BigInt, ceil, ausência→vazio), provider NÃO
 * executável. Sem SDK, sem rede, sem segredo.
 */

import { describe, expect, it } from 'vitest';
import {
  ANTHROPIC_PROVIDER_KEY,
  ANTHROPIC_PROVIDER_VERSION,
  ANTHROPIC_CONNECTOR_KEY,
  ANTHROPIC_PROVIDER_DEFINITION_CONTRACT,
  ANTHROPIC_MODEL_CATALOG,
  ANTHROPIC_ALLOWED_MODEL_IDS,
  isAllowedAnthropicModelId,
  ANTHROPIC_RATE_CARDS,
  estimateComponentCostMinor,
  commercialModelCatalogEntry,
} from '@arden/contracts';

describe('Anthropic — chaves e definição', () => {
  it('provider key distingue API direta; version e connector definidos', () => {
    expect(ANTHROPIC_PROVIDER_KEY).toBe('anthropic.direct');
    expect(ANTHROPIC_PROVIDER_VERSION).toBe('1');
    expect(ANTHROPIC_CONNECTOR_KEY).toBe('system.anthropic');
  });
  it('provider NÃO é executável nesta fase (DISABLED, productionAllowed=false, CONTRACT_ONLY)', () => {
    expect(ANTHROPIC_PROVIDER_DEFINITION_CONTRACT.status).toBe('DISABLED');
    expect(ANTHROPIC_PROVIDER_DEFINITION_CONTRACT.productionAllowed).toBe(false);
    expect(ANTHROPIC_PROVIDER_DEFINITION_CONTRACT.implementationStatus).toBe('CONTRACT_ONLY');
    expect(ANTHROPIC_PROVIDER_DEFINITION_CONTRACT.capabilities).toEqual(['STRUCTURED_OUTPUT']);
  });
});

describe('Anthropic — catálogo de modelos', () => {
  it('todo modelId é allowlisted e não vazio; nenhum arbitrário', () => {
    expect(ANTHROPIC_MODEL_CATALOG.length).toBeGreaterThan(0);
    for (const m of ANTHROPIC_MODEL_CATALOG) {
      expect(commercialModelCatalogEntry.safeParse(m).success).toBe(true);
      expect(m.modelId.startsWith('claude-')).toBe(true);
      expect(isAllowedAnthropicModelId(m.modelId)).toBe(true);
    }
    expect(isAllowedAnthropicModelId('gpt-4')).toBe(false);
    expect(isAllowedAnthropicModelId('claude-not-real')).toBe(false);
  });
  it('cada entrada tem ≥1 fonte oficial e limites null (não verificados) ou positivos', () => {
    for (const m of ANTHROPIC_MODEL_CATALOG) {
      expect(m.sourceReferences.length).toBeGreaterThan(0);
      expect(m.maximumInputTokens === null || m.maximumInputTokens > 0).toBe(true);
      expect(m.maximumOutputTokens === null || m.maximumOutputTokens > 0).toBe(true);
      // Não executável: productionAllowed=false / status DISABLED nesta fase.
      expect(m.productionAllowed).toBe(false);
      expect(m.status).toBe('DISABLED');
    }
  });
  it('usa snapshots datados (reprodutibilidade)', () => {
    for (const m of ANTHROPIC_MODEL_CATALOG) expect(/\d{8}$/.test(m.modelId)).toBe(true);
  });
  it('allowlist sem duplicatas', () => {
    expect(new Set(ANTHROPIC_ALLOWED_MODEL_IDS).size).toBe(ANTHROPIC_ALLOWED_MODEL_IDS.length);
  });
});

describe('Anthropic — rate cards (precisão BigInt, sem float, sem preço inventado)', () => {
  it('catálogo de rate cards VAZIO nesta fase (preços não verificados)', () => {
    expect(ANTHROPIC_RATE_CARDS.length).toBe(0);
  });
  it('custo por componente: ceil inteiro, sem float', () => {
    const rate = 3000n; // exemplo SINTÉTICO (não é preço real).
    expect(estimateComponentCostMinor(1_000_000, rate)).toBe(3000n); // 1M tokens → 3000 minor
    expect(estimateComponentCostMinor(1000, rate)).toBe(3n); // ceil(3000*1000/1e6)=3
    expect(estimateComponentCostMinor(1, rate)).toBe(1n); // ceil(0.003)=1
    expect(estimateComponentCostMinor(0, rate)).toBe(0n);
    expect(estimateComponentCostMinor(1_000_000, 0n)).toBe(0n); // rate zero conhecido → 0
  });
  it('resultado é sempre BigInt (nunca number/float)', () => {
    expect(typeof estimateComponentCostMinor(1234, 1500n)).toBe('bigint');
  });
});
