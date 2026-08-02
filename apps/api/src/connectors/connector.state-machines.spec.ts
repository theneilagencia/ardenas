/**
 * Arden.AS API — testes das máquinas de estado de conectores (ARDEN-BE-006.3).
 */

import { describe, expect, it } from 'vitest';
import {
  canTransitionConnection, isConnectionTerminal,
  canTransitionCredential, isCredentialTerminal,
  canTransitionWebhookEndpoint, isWebhookEndpointTerminal,
  canTransitionWebhookDelivery, isWebhookDeliveryTerminal,
} from './connector.state-machines';

describe('connection state machine', () => {
  it('permite as transições válidas', () => {
    expect(canTransitionConnection('DRAFT', 'ACTIVE')).toBe(true);
    expect(canTransitionConnection('DRAFT', 'REVOKED')).toBe(true);
    expect(canTransitionConnection('ACTIVE', 'SUSPENDED')).toBe(true);
    expect(canTransitionConnection('ACTIVE', 'ERROR')).toBe(true);
    expect(canTransitionConnection('SUSPENDED', 'ACTIVE')).toBe(true);
    expect(canTransitionConnection('ERROR', 'ACTIVE')).toBe(true);
  });
  it('rejeita transições inválidas e REVOKED é terminal', () => {
    expect(canTransitionConnection('DRAFT', 'SUSPENDED')).toBe(false);
    expect(canTransitionConnection('REVOKED', 'ACTIVE')).toBe(false);
    expect(canTransitionConnection('SUCCEEDED' as never, 'ACTIVE')).toBe(false);
    expect(isConnectionTerminal('REVOKED')).toBe(true);
    expect(isConnectionTerminal('ACTIVE')).toBe(false);
  });
});

describe('credential state machine', () => {
  it('permite PENDING→ACTIVE→SUPERSEDED→REVOKED; nunca volta a ACTIVE', () => {
    expect(canTransitionCredential('PENDING', 'ACTIVE')).toBe(true);
    expect(canTransitionCredential('PENDING', 'REVOKED')).toBe(true);
    expect(canTransitionCredential('ACTIVE', 'SUPERSEDED')).toBe(true);
    expect(canTransitionCredential('ACTIVE', 'REVOKED')).toBe(true);
    expect(canTransitionCredential('SUPERSEDED', 'REVOKED')).toBe(true);
    expect(canTransitionCredential('SUPERSEDED', 'ACTIVE')).toBe(false);
    expect(canTransitionCredential('REVOKED', 'ACTIVE')).toBe(false);
    expect(isCredentialTerminal('REVOKED')).toBe(true);
  });
});

describe('webhook endpoint state machine', () => {
  it('ACTIVE↔SUSPENDED, →REVOKED terminal', () => {
    expect(canTransitionWebhookEndpoint('ACTIVE', 'SUSPENDED')).toBe(true);
    expect(canTransitionWebhookEndpoint('SUSPENDED', 'ACTIVE')).toBe(true);
    expect(canTransitionWebhookEndpoint('ACTIVE', 'REVOKED')).toBe(true);
    expect(canTransitionWebhookEndpoint('REVOKED', 'ACTIVE')).toBe(false);
    expect(isWebhookEndpointTerminal('REVOKED')).toBe(true);
  });
});

describe('webhook delivery state machine', () => {
  it('RECEIVED→ACCEPTED/REJECTED/REPLAYED; ACCEPTED→PROCESSED/FAILED', () => {
    expect(canTransitionWebhookDelivery('RECEIVED', 'ACCEPTED')).toBe(true);
    expect(canTransitionWebhookDelivery('RECEIVED', 'REJECTED')).toBe(true);
    expect(canTransitionWebhookDelivery('RECEIVED', 'REPLAYED')).toBe(true);
    expect(canTransitionWebhookDelivery('ACCEPTED', 'PROCESSED')).toBe(true);
    expect(canTransitionWebhookDelivery('ACCEPTED', 'FAILED')).toBe(true);
    expect(canTransitionWebhookDelivery('PROCESSED', 'FAILED')).toBe(false);
    expect(canTransitionWebhookDelivery('REJECTED', 'ACCEPTED')).toBe(false);
    expect(isWebhookDeliveryTerminal('PROCESSED')).toBe(true);
    expect(isWebhookDeliveryTerminal('RECEIVED')).toBe(false);
  });
});
