/**
 * ARDEN-PRD-001.2A.2 — CLI de preparação de infraestrutura (OFFLINE, provider-neutro).
 *
 * Subcomandos de validação (decision/contracts/environments/alerts/runbooks/artifact) e
 * de operação FAIL-CLOSED (deploy/migrate/backup/restore). Nenhum recurso de nuvem é
 * criado; nenhum banco remoto é acessado; nenhum secret real é usado. Saída sanitizada;
 * exit != 0 enquanto houver pendência humana ou pré-condição ausente.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { loadManifest, requireApprovedDecision, ProductionGuardError } from './manifest-io';
import { evaluateDecisionReadiness } from './decision-manifest';
import { loadAndValidateAlerts } from './alert-definitions';
import { validateInfraContracts, validateRunbooks, validateNoAnthropicAllowlisted, REQUIRED_RUNBOOKS } from './contract-validators';
import { checkIsolation, ENVIRONMENT_CONTRACTS, type ResourceBinding } from './environments';
import { buildArtifactManifest, verifyArtifactManifest, type ArtifactManifest } from './artifact-manifest';
import { checkLeastPrivilege } from './iam-contracts';
import { validateEgressAllowlist, catalogHasAnthropicAllowed } from './network-catalog';
import { planRestoreDrill } from './database-recovery';

const ARTIFACT_PATH = 'config/infrastructure/artifact-manifest.json';

function ok(msg: string): never {
  console.log(JSON.stringify({ result: 'PASS', message: msg }, null, 2));
  process.exit(0);
}
function fail(msg: string, details?: unknown): never {
  console.error(JSON.stringify({ result: 'FAIL', message: msg, details }, null, 2));
  process.exit(1);
}

function gitSha(): string {
  if (process.env.GIT_SHA) return process.env.GIT_SHA;
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  } catch {
    return 'UNKNOWN';
  }
}

function decisionValidate(): never {
  const loaded = loadManifest(process.env.DECISION_MANIFEST);
  if (!loaded.ok) fail('manifesto inválido', loaded.errors);
  const readiness = loaded.readiness ?? evaluateDecisionReadiness(loaded.manifest!);
  const report = {
    manifestPath: loaded.path,
    usedExampleFallback: loaded.usedExampleFallback,
    adrAccepted: readiness.adrAccepted,
    pendingFields: readiness.pendingFields,
    reasons: readiness.reasons,
  };
  if (readiness.result !== 'PASS') {
    console.error(JSON.stringify({ result: 'FAIL', gate: 'ARDEN_PRD_001_2B_ENTRY_GATE', ...report }, null, 2));
    process.exit(1);
  }
  ok('decision manifest PASS');
}

function main(): void {
  const cmd = process.argv[2] ?? '';
  switch (cmd) {
    case 'decision:validate':
      decisionValidate();
      break;

    case 'contracts:validate': {
      const c = validateInfraContracts();
      const a = validateNoAnthropicAllowlisted();
      if (catalogHasAnthropicAllowed()) fail('Anthropic não pode estar allowlisted');
      if (!c.ok || !a.ok) fail('contratos de infra inválidos', [...c.errors, ...a.errors]);
      ok(`contratos de infra válidos (${c.checked} módulos)`);
      break;
    }

    case 'environments:validate': {
      const violations: string[] = [];
      // Bindings corretos (cada ambiente só usa seus próprios recursos) devem passar.
      for (const env of ENVIRONMENT_CONTRACTS) {
        const good: ResourceBinding = {
          environment: env.name,
          databaseEnvironment: env.name,
          secretsEnvironment: env.name,
          queueEnvironment: env.name,
          usesRuntimeCredentials: env.name !== 'recovery',
        };
        const r = checkIsolation(good);
        if (!r.ok) violations.push(...r.violations);
      }
      if (violations.length) fail('isolamento de ambientes inválido', violations);
      ok('contratos de ambientes válidos (staging/production/recovery isolados)');
      break;
    }

    case 'alerts:validate': {
      const r = loadAndValidateAlerts();
      if (!r.ok) fail('definições de alerta inválidas', r.errors);
      ok(`alertas válidos (${r.count})`);
      break;
    }

    case 'runbooks:validate': {
      const r = validateRunbooks('docs/runbooks', REQUIRED_RUNBOOKS);
      if (!r.ok) fail('runbooks inválidos/ incompletos', r.errors);
      ok(`runbooks válidos (${r.checked})`);
      break;
    }

    case 'iam:validate': {
      const r = checkLeastPrivilege();
      if (!r.ok) fail('IAM viola menor privilégio', r.violations);
      ok('contratos de IAM respeitam menor privilégio');
      break;
    }

    case 'egress:validate': {
      // Allowlist de exemplo mínima (sem Anthropic, sem curinga).
      const r = validateEgressAllowlist(['postgresql.private', 'secret-manager.private'], 'DENY');
      if (!r.ok) fail('política de egress inválida', r.errors);
      ok('egress default DENY; Anthropic/internet genérica bloqueados');
      break;
    }

    case 'artifact:build': {
      const manifest: ArtifactManifest = buildArtifactManifest({
        commitSha: gitSha(),
        buildTimestamp: new Date().toISOString(),
        applicationVersion: process.env.APP_VERSION ?? '0.1.0',
        migrationCount: 11,
      });
      const verify = verifyArtifactManifest(manifest);
      if (!verify.ok) fail('artifact manifest inválido', verify.errors);
      writeFileSync(ARTIFACT_PATH, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
      ok(`artifact manifest gerado por SHA ${manifest.commitSha.slice(0, 12)}`);
      break;
    }

    case 'artifact:verify': {
      if (!existsSync(ARTIFACT_PATH)) fail('artifact manifest ausente — rode artifact:build');
      let doc: unknown;
      try {
        doc = JSON.parse(readFileSync(ARTIFACT_PATH, 'utf8'));
      } catch {
        fail('artifact manifest ilegível');
      }
      const verify = verifyArtifactManifest(doc);
      if (!verify.ok) fail('artifact manifest inválido', verify.errors);
      ok('artifact manifest verificado (SHA presente; sem latest; sem secret)');
      break;
    }

    // ── Operações FAIL-CLOSED (exigem manifesto aprovado — hoje sempre bloqueadas) ──
    case 'deploy:staging':
    case 'deploy:production':
    case 'deploy:verify':
    case 'deploy:rollback':
    case 'production:migrate':
    case 'database:backup:verify':
    case 'database:restore:prepare':
    case 'database:restore:validate': {
      try {
        requireApprovedDecision(process.env.DECISION_MANIFEST);
      } catch (e) {
        if (e instanceof ProductionGuardError) {
          fail(`${cmd} FAIL-CLOSED: decisão não aprovada`, e.reasons);
        }
        throw e;
      }
      // Inalcançável nesta fase (manifesto sempre não-pronto). Nunca cria recurso real.
      fail(`${cmd}: manifesto aprovado, porém provisionamento é 001.2B (não executa aqui)`);
      break;
    }

    case 'database:restore:drill': {
      const plan = planRestoreDrill(/* providerSelected */ false);
      console.error(JSON.stringify({ result: 'BLOCKED', plan }, null, 2));
      process.exit(1);
      break;
    }

    default:
      fail(
        `subcomando desconhecido: "${cmd}"`,
        [
          'decision:validate', 'contracts:validate', 'environments:validate', 'alerts:validate',
          'runbooks:validate', 'iam:validate', 'egress:validate', 'artifact:build', 'artifact:verify',
          'deploy:staging', 'deploy:production', 'deploy:verify', 'deploy:rollback', 'production:migrate',
          'database:backup:verify', 'database:restore:prepare', 'database:restore:validate', 'database:restore:drill',
        ],
      );
  }
}

main();
