/**
 * Arden.AS API — testes das máquinas de estado do runtime de agentes (ARDEN-BE-007.2).
 * Verificam transições permitidas, terminais e proibições (published↛draft, retired↛published).
 */

import { describe, expect, it } from 'vitest';
import {
  canTransitionAgent,
  isAgentTerminal,
  canTransitionAgentVersion,
  isAgentVersionTerminal,
  isAgentVersionImmutable,
  canTransitionModelConfiguration,
  isModelConfigurationTerminal,
} from './agent.state-machines';

describe('AgentDefinition state machine', () => {
  it('permite DRAFT→ACTIVE/REVOKED, ACTIVE→SUSPENDED/REVOKED, SUSPENDED→ACTIVE/REVOKED', () => {
    expect(canTransitionAgent('DRAFT', 'ACTIVE')).toBe(true);
    expect(canTransitionAgent('DRAFT', 'REVOKED')).toBe(true);
    expect(canTransitionAgent('ACTIVE', 'SUSPENDED')).toBe(true);
    expect(canTransitionAgent('ACTIVE', 'REVOKED')).toBe(true);
    expect(canTransitionAgent('SUSPENDED', 'ACTIVE')).toBe(true);
    expect(canTransitionAgent('SUSPENDED', 'REVOKED')).toBe(true);
  });
  it('REVOKED é terminal (nenhuma saída, não reativa)', () => {
    expect(isAgentTerminal('REVOKED')).toBe(true);
    expect(canTransitionAgent('REVOKED', 'ACTIVE')).toBe(false);
    expect(canTransitionAgent('REVOKED', 'DRAFT')).toBe(false);
  });
  it('não permite DRAFT direto para SUSPENDED', () => {
    expect(canTransitionAgent('DRAFT', 'SUSPENDED')).toBe(false);
  });
});

describe('AgentVersion state machine', () => {
  it('permite DRAFT→PUBLISHED/RETIRED e PUBLISHED→RETIRED', () => {
    expect(canTransitionAgentVersion('DRAFT', 'PUBLISHED')).toBe(true);
    expect(canTransitionAgentVersion('DRAFT', 'RETIRED')).toBe(true);
    expect(canTransitionAgentVersion('PUBLISHED', 'RETIRED')).toBe(true);
  });
  it('proíbe PUBLISHED→DRAFT e RETIRED→PUBLISHED', () => {
    expect(canTransitionAgentVersion('PUBLISHED', 'DRAFT')).toBe(false);
    expect(canTransitionAgentVersion('RETIRED', 'PUBLISHED')).toBe(false);
    expect(canTransitionAgentVersion('RETIRED', 'DRAFT')).toBe(false);
  });
  it('RETIRED é terminal; PUBLISHED e RETIRED são imutáveis', () => {
    expect(isAgentVersionTerminal('RETIRED')).toBe(true);
    expect(isAgentVersionTerminal('PUBLISHED')).toBe(false);
    expect(isAgentVersionImmutable('PUBLISHED')).toBe(true);
    expect(isAgentVersionImmutable('RETIRED')).toBe(true);
    expect(isAgentVersionImmutable('DRAFT')).toBe(false);
  });
});

describe('ModelConfiguration state machine', () => {
  it('permite DRAFT→ACTIVE/REVOKED, ACTIVE→SUSPENDED/REVOKED, SUSPENDED→ACTIVE/REVOKED', () => {
    expect(canTransitionModelConfiguration('DRAFT', 'ACTIVE')).toBe(true);
    expect(canTransitionModelConfiguration('ACTIVE', 'SUSPENDED')).toBe(true);
    expect(canTransitionModelConfiguration('SUSPENDED', 'ACTIVE')).toBe(true);
    expect(canTransitionModelConfiguration('ACTIVE', 'REVOKED')).toBe(true);
  });
  it('REVOKED é terminal (não reativa)', () => {
    expect(isModelConfigurationTerminal('REVOKED')).toBe(true);
    expect(canTransitionModelConfiguration('REVOKED', 'ACTIVE')).toBe(false);
  });
});
