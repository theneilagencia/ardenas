/**
 * ARDEN-PRD-001.2A.2 — Testes offline da preparação de infraestrutura.
 * Cobrem os 30 cenários do escopo. Nenhum recurso externo é tocado.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as yaml from 'js-yaml';
import { describe, it, expect } from 'vitest';
import {
  parseDecisionManifest,
  evaluateDecisionReadiness,
  isSentinel,
  type ProductionDecisionManifest,
} from './decision-manifest';
import { loadManifest, requireApprovedDecision, ProductionGuardError } from './manifest-io';
import { computeConnectionBudget } from './connection-budget';
import { buildArtifactManifest, verifyArtifactManifest } from './artifact-manifest';
import { checkLeastPrivilege, IAM_CONTRACTS } from './iam-contracts';
import { validateEgressAllowlist, catalogHasAnthropicAllowed, NETWORK_DESTINATION_CATALOG } from './network-catalog';
import { loadAndValidateAlerts } from './alert-definitions';
import { checkIsolation } from './environments';
import { validateInfraContracts, validateRunbooks, REQUIRED_RUNBOOKS } from './contract-validators';
import { planSmoke } from './smoke';
import { UnselectedRecoveryAdapter, planRestoreDrill } from './database-recovery';

const EXAMPLE = 'config/infrastructure/production-decision.example.yaml';

function exampleManifest(): ProductionDecisionManifest {
  const doc = yaml.load(readFileSync(resolve(process.cwd(), EXAMPLE), 'utf8'));
  const parsed = parseDecisionManifest(doc);
  expect(parsed.ok).toBe(true);
  return parsed.manifest!;
}

/** Manifesto sintético COMPLETO (apenas para teste — nenhum valor real de produção). */
function completeManifest(): ProductionDecisionManifest {
  return {
    provider: 'GCP',
    primaryRegion: 'test-region-a',
    recoveryRegion: 'test-region-b',
    stagingMonthlyBudgetMinor: '100000',
    pilotMonthlyBudgetMinor: '200000',
    productionMonthlyBudgetMinor: '300000',
    currency: 'USD',
    minimumSlaPercent: '99.9',
    supportPlan: 'business',
    approvedRpoMinutes: 5,
    approvedRtoMinutes: 60,
    managedPostgresProduct: 'test-pg',
    platformSecretManagerProduct: 'test-sm',
    apiComputeProduct: 'test-api',
    workerComputeProduct: 'test-worker',
    containerRegistryProduct: 'test-registry',
    observabilityProduct: 'test-obs',
    legalApprovalReference: 'LEGAL-TEST-1',
    dpaApprovalReference: 'DPA-TEST-1',
    businessApprovalReference: 'BIZ-TEST-1',
    technicalApprovalReference: 'TECH-TEST-1',
    operationsOwner: 'ops-role',
    adrStatus: 'ACCEPTED',
    decisionDate: '2026-01-01T00:00:00Z',
    reviewDate: '2026-07-01T00:00:00Z',
  };
}

describe('ARDEN-PRD-001.2A.2 — decision manifest & entry gate', () => {
  it('01 — manifesto inválido é rejeitado', () => {
    expect(parseDecisionManifest({ provider: 'GCP' }).ok).toBe(false);
  });

  it('02 — ADR proposta bloqueia execução (readiness FAIL)', () => {
    const r = evaluateDecisionReadiness(exampleManifest());
    expect(r.result).toBe('FAIL');
    expect(r.adrAccepted).toBe(false);
  });

  it('03 — provider ausente (sentinela) é pendente', () => {
    const m = { ...completeManifest(), provider: 'TBD' as const };
    expect(evaluateDecisionReadiness(m).pendingFields).toContain('provider');
  });

  it('04 — região ausente é pendente', () => {
    const m = { ...completeManifest(), primaryRegion: 'REQUIRES_LEGAL_REVIEW' };
    expect(evaluateDecisionReadiness(m).pendingFields).toContain('primaryRegion');
  });

  it('05 — orçamento ausente é pendente', () => {
    const m = { ...completeManifest(), stagingMonthlyBudgetMinor: 'REQUIRES_QUOTE' };
    expect(evaluateDecisionReadiness(m).pendingFields).toContain('stagingMonthlyBudgetMinor');
  });

  it('06 — jurídico ausente é pendente', () => {
    const m = { ...completeManifest(), legalApprovalReference: 'REQUIRES_LEGAL_REVIEW' };
    expect(evaluateDecisionReadiness(m).pendingFields).toContain('legalApprovalReference');
  });

  it('07 — RPO/RTO ausentes são pendentes', () => {
    const m = { ...completeManifest(), approvedRpoMinutes: 'REQUIRES_APPROVAL' as const, approvedRtoMinutes: 'REQUIRES_APPROVAL' as const };
    const p = evaluateDecisionReadiness(m).pendingFields;
    expect(p).toContain('approvedRpoMinutes');
    expect(p).toContain('approvedRtoMinutes');
  });

  it('08 — manifesto sintético completo passa (só em teste)', () => {
    expect(evaluateDecisionReadiness(completeManifest()).result).toBe('PASS');
  });

  it('sentinelas nunca são valor de decisão', () => {
    expect(isSentinel('TBD')).toBe(true);
    expect(isSentinel('GCP')).toBe(false);
  });
});

describe('ARDEN-PRD-001.2A.2 — environment isolation', () => {
  it('09 — isolamento correto passa', () => {
    expect(checkIsolation({ environment: 'staging', databaseEnvironment: 'staging', secretsEnvironment: 'staging', queueEnvironment: 'staging', usesRuntimeCredentials: true }).ok).toBe(true);
  });
  it('10 — staging→banco de produção é violação', () => {
    const r = checkIsolation({ environment: 'staging', databaseEnvironment: 'production', secretsEnvironment: 'staging', queueEnvironment: 'staging', usesRuntimeCredentials: true });
    expect(r.ok).toBe(false);
  });
  it('11 — staging→secrets de produção é violação', () => {
    const r = checkIsolation({ environment: 'staging', databaseEnvironment: 'staging', secretsEnvironment: 'production', queueEnvironment: 'staging', usesRuntimeCredentials: true });
    expect(r.ok).toBe(false);
  });
  it('recovery não usa credenciais de runtime', () => {
    const r = checkIsolation({ environment: 'recovery', databaseEnvironment: 'recovery', secretsEnvironment: 'recovery', queueEnvironment: 'recovery', usesRuntimeCredentials: true });
    expect(r.ok).toBe(false);
  });
});

describe('ARDEN-PRD-001.2A.2 — connection budget', () => {
  it('12 — bloqueado sem limite do banco', () => {
    const r = computeConnectionBudget({ apiReplicas: 2, poolPerApiReplica: 5, workerReplicas: 1, poolPerWorkerReplica: 5, migrationConnections: 1, adminConnections: 1, restoreDrillConnections: 0, approvedSafetyFactor: 0.8, databaseConnectionLimit: null });
    expect(r.result).toBe('BLOCKED');
  });
  it('13 — válido dentro do limite efetivo', () => {
    const r = computeConnectionBudget({ apiReplicas: 2, poolPerApiReplica: 5, workerReplicas: 1, poolPerWorkerReplica: 5, migrationConnections: 1, adminConnections: 1, restoreDrillConnections: 0, approvedSafetyFactor: 0.8, databaseConnectionLimit: 100 });
    expect(r.result).toBe('OK');
  });
  it('excede quando reservado >= limite efetivo', () => {
    const r = computeConnectionBudget({ apiReplicas: 20, poolPerApiReplica: 10, workerReplicas: 10, poolPerWorkerReplica: 10, migrationConnections: 1, adminConnections: 1, restoreDrillConnections: 0, approvedSafetyFactor: 0.8, databaseConnectionLimit: 100 });
    expect(r.result).toBe('EXCEEDED');
  });
});

describe('ARDEN-PRD-001.2A.2 — fail-closed ops', () => {
  it('14 — direct/runtime URL separation nos contratos de IAM', () => {
    const mig = IAM_CONTRACTS.find((c) => c.identity === 'migration-job')!;
    expect(mig.usesDirectDatabaseUrl).toBe(true);
    expect(mig.usesRuntimeDatabaseUrl).toBe(false);
  });
  it('15 — deploy fail-closed sem manifesto aprovado', () => {
    expect(() => requireApprovedDecision(EXAMPLE)).toThrow(ProductionGuardError);
  });
  it('16 — migration fail-closed sem manifesto aprovado', () => {
    // mesmo guard compartilhado
    let code = '';
    try { requireApprovedDecision(EXAMPLE); } catch (e) { code = (e as ProductionGuardError).code; }
    expect(code).toBe('DECISION_NOT_APPROVED');
  });
  it('17 — backup fail-closed (adapter não selecionado)', async () => {
    await expect(new UnselectedRecoveryAdapter().inspectBackups()).rejects.toThrow(/NOT_SELECTED/);
  });
  it('18 — restore fail-closed (adapter não selecionado) + drill BLOCKED', async () => {
    await expect(new UnselectedRecoveryAdapter().requestRestore()).rejects.toThrow(/NOT_SELECTED/);
    expect(planRestoreDrill(false).canProceed).toBe(false);
  });
  it('19 — smoke exige URL explícita (default não executa)', () => {
    expect(planSmoke(undefined).willExecute).toBe(false);
    expect(planSmoke('https://staging.example.test').willExecute).toBe(true);
  });
});

describe('ARDEN-PRD-001.2A.2 — network egress', () => {
  it('20 — Anthropic egress bloqueado', () => {
    expect(catalogHasAnthropicAllowed()).toBe(false);
    const anthropic = NETWORK_DESTINATION_CATALOG.find((d) => d.id === 'anthropic')!;
    expect(anthropic.status).toBe('BLOCKED');
    expect(validateEgressAllowlist(['api.anthropic.com'], 'DENY').ok).toBe(false);
  });
  it('21 — internet genérica bloqueada (curinga proibido; default DENY)', () => {
    expect(validateEgressAllowlist(['*'], 'DENY').ok).toBe(false);
    expect(validateEgressAllowlist(['postgresql.private'], 'ALLOW').ok).toBe(false);
    const generic = NETWORK_DESTINATION_CATALOG.find((d) => d.id === 'generic-internet')!;
    expect(generic.status).toBe('BLOCKED');
  });
});

describe('ARDEN-PRD-001.2A.2 — artifact integrity', () => {
  const m = buildArtifactManifest({ commitSha: 'abcdef1234567890', buildTimestamp: '2026-01-01T00:00:00Z', applicationVersion: '0.1.0', migrationCount: 11 });
  it('22 — artifact identificado por SHA', () => {
    expect(verifyArtifactManifest(m).ok).toBe(true);
    expect(m.commitSha.length).toBeGreaterThanOrEqual(7);
  });
  it('23 — tag latest é rejeitada', () => {
    expect(verifyArtifactManifest({ ...m, commitSha: 'latest' }).ok).toBe(false);
  });
  it('24 — nenhum secret na imagem/manifesto (canário)', () => {
    const bad = { ...m, secretToken: 'AKIA0123456789ABCDEF' } as unknown;
    expect(verifyArtifactManifest(bad).ok).toBe(false);
  });
  it('25 — nenhum secret no manifesto (chave proibida)', () => {
    expect(verifyArtifactManifest({ ...m, password: 'x' } as unknown).ok).toBe(false);
  });
});

describe('ARDEN-PRD-001.2A.2 — IAM, alerts, contracts, runbooks', () => {
  it('26 — contratos de IAM respeitam menor privilégio', () => {
    expect(checkLeastPrivilege().ok).toBe(true);
    // runtime nunca lê a wrapping key
    const api = IAM_CONTRACTS.find((c) => c.identity === 'api-runtime')!;
    expect(api.readablePlatformSecrets).not.toContain('CONNECTOR_MASTER_KEY_BACKUP_WRAPPING_KEY');
  });
  it('27 — schema de alertas válido (19 alertas)', () => {
    const r = loadAndValidateAlerts();
    expect(r.ok).toBe(true);
    expect(r.count).toBe(19);
  });
  it('28 — runbooks referenciados existem com seções', () => {
    const r = validateRunbooks('docs/runbooks', REQUIRED_RUNBOOKS);
    expect(r.ok).toBe(true);
    expect(r.checked).toBe(REQUIRED_RUNBOOKS.length);
  });
  it('contratos de IaC provider-neutros válidos', () => {
    const r = validateInfraContracts('infra');
    expect(r.ok).toBe(true);
    expect(r.checked).toBe(9);
  });
});

describe('ARDEN-PRD-001.2A.2 — checklists blocked', () => {
  it('29 — staging checklist está BLOCKED (entry gate FAIL)', () => {
    const gate = loadManifest(EXAMPLE);
    expect(gate.readiness?.result).toBe('FAIL');
  });
  it('30 — production checklist independente e bloqueado', () => {
    // Produção nunca liberada só porque staging passou; entry gate ainda FAIL.
    const gate = evaluateDecisionReadiness(exampleManifest());
    expect(gate.result).toBe('FAIL');
  });
});
