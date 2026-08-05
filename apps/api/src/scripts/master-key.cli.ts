/**
 * Arden.AS API — CLI operacional da connector master key (ARDEN-PRD-001.1D).
 *
 * Subcomandos: status | verify | reencrypt | backup | restore:verify | drill | secrets:verify.
 * Saída SANITIZADA (nunca imprime segredo, material de chave, ciphertext ou env completo).
 * Exit codes: 0 sucesso · 1 falha operacional · 2 configuração inválida · 3 integridade/
 * cripto inválida · 4 execução parcial. Não interativo (adequado a CI).
 *
 * Uso: ARDEN_CLI=master-key vite-node src/scripts/master-key.cli.ts <subcommand> [flags]
 */

import { PrismaClient } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { loadConfig } from '../config/env.schema';
import { ConnectorKeyProvider } from '../connectors/vault/connector-key-provider';
import {
  ConnectorCredentialReencryptionService,
} from '../security/connector-credential-reencryption.service';
import { PrismaReencryptionDb } from '../security/connector-reencryption.prisma-adapter';
import { computeConnectorMasterKeyPreflight } from '../security/connector-master-key-preflight.service';
import {
  buildConnectorMasterKeyring,
  type KeyringInput,
} from '../security/connector-master-keyring';
import {
  createConnectorMasterKeyBackup,
  restoreConnectorMasterKeyBackup,
  verifyConnectorMasterKeyRestore,
} from '../security/connector-master-key-backup';

type ExitCode = 0 | 1 | 2 | 3 | 4;

function out(obj: unknown): void {
  // Sempre JSON sanitizado (sem segredo/ciphertext).
  process.stdout.write(`${JSON.stringify(obj, null, 2)}\n`);
}

function parseFlags(argv: string[]): Record<string, string | boolean> {
  const flags: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      flags[key] = next;
      i += 1;
    } else {
      flags[key] = true;
    }
  }
  return flags;
}

/** Keyring do config para os comandos que precisam do material (backup/drill). */
function keyringInputFromConfig(config: ReturnType<typeof loadConfig>): KeyringInput {
  const keys: Record<string, string> = {};
  if (config.CONNECTOR_MASTER_KEY) keys[config.CONNECTOR_KEY_VERSION] = config.CONNECTOR_MASTER_KEY;
  if (config.CONNECTOR_KEYRING_JSON) {
    const parsed = JSON.parse(config.CONNECTOR_KEYRING_JSON) as Record<string, string>;
    for (const [v, b64] of Object.entries(parsed)) keys[v] = b64;
  }
  return { primaryVersion: config.CONNECTOR_KEY_VERSION, keys };
}

async function main(): Promise<ExitCode> {
  const [subcommand, ...rest] = process.argv.slice(2);
  const flags = parseFlags(rest);

  let config: ReturnType<typeof loadConfig>;
  try {
    config = loadConfig();
  } catch {
    out({ command: subcommand, status: 'error', code: 'MASTER_KEY_CONFIGURATION_INVALID' });
    return 2;
  }
  const keys = new ConnectorKeyProvider(config);

  switch (subcommand) {
    case 'secrets:verify':
    case 'verify': {
      // Valida o keyring (invariantes) sem tocar no banco.
      try {
        buildConnectorMasterKeyring(keyringInputFromConfig(config));
        out({ command: subcommand, status: 'ok', primaryVersion: keys.describeKeyring().primaryVersion });
        return 0;
      } catch {
        out({ command: subcommand, status: 'error', code: 'MASTER_KEY_CONFIGURATION_INVALID' });
        return 3;
      }
    }
    case 'status': {
      const prisma = new PrismaClient();
      try {
        const svc = new ConnectorCredentialReencryptionService(new PrismaReencryptionDb(prisma), keys);
        const ins = await svc.inspect();
        const pre = await computeConnectorMasterKeyPreflight(keys.describeKeyring(), ins.referencedVersions);
        out({
          command: 'status',
          primaryVersion: pre.primaryKeyVersion,
          decryptOnlyVersions: pre.availableVersions.filter((v) => v !== pre.primaryKeyVersion),
          referencedVersions: pre.referencedVersions,
          missingVersions: pre.missingVersions,
          reencryptionEligibleCount: ins.eligibleCount,
          preflightStatus: pre.status,
        });
        return pre.status === 'OK' ? 0 : 3;
      } finally {
        await prisma.$disconnect();
      }
    }
    case 'reencrypt': {
      const prisma = new PrismaClient();
      try {
        const svc = new ConnectorCredentialReencryptionService(new PrismaReencryptionDb(prisma), keys);
        const pre = await computeConnectorMasterKeyPreflight(keys.describeKeyring(), (await svc.inspect()).referencedVersions);
        if (pre.status !== 'OK') {
          out({ command: 'reencrypt', status: 'refused', preflightStatus: pre.status, missingVersions: pre.missingVersions });
          return 3;
        }
        const dryRun = flags['dry-run'] === true;
        const batchSize = Number(flags['batch-size'] ?? 100);
        const maximumBatches = Number(flags['maximum-batches'] ?? 1000);
        const sourceVersion = typeof flags['source-version'] === 'string' ? (flags['source-version'] as string) : undefined;
        const totals = { scanned: 0, reencrypted: 0, skippedConcurrentChange: 0, failed: 0, batches: 0 };
        for (let b = 0; b < maximumBatches; b += 1) {
          const r = await svc.runBatch({ batchSize, dryRun, sourceVersion });
          totals.scanned += r.scanned;
          totals.reencrypted += r.reencrypted;
          totals.skippedConcurrentChange += r.skippedConcurrentChange;
          totals.failed += r.failed;
          totals.batches += 1;
          if (!r.hasMore || dryRun) break;
        }
        out({ command: 'reencrypt', dryRun, targetVersion: keys.describeKeyring().primaryVersion, ...totals });
        return totals.failed > 0 ? 4 : 0;
      } finally {
        await prisma.$disconnect();
      }
    }
    case 'backup': {
      try {
        const keyring = buildConnectorMasterKeyring(keyringInputFromConfig(config));
        const wrappingKey = resolveWrappingKey(config);
        const createdAt = new Date().toISOString();
        const artifact = createConnectorMasterKeyBackup({ keyring, wrappingKey, environment: config.NODE_ENV, createdAt });
        const outPath = typeof flags.output === 'string' ? (flags.output as string) : undefined;
        if (outPath) {
          const fs = await import('node:fs');
          if (fs.existsSync(outPath) && flags.force !== true) {
            out({ command: 'backup', status: 'refused', reason: 'output exists (use --force)' });
            return 1;
          }
          fs.writeFileSync(outPath, JSON.stringify(artifact), { encoding: 'utf8' });
        }
        out({ command: 'backup', status: 'ok', manifest: artifact.manifest, written: !!outPath });
        return 0;
      } catch {
        out({ command: 'backup', status: 'error', code: 'MASTER_KEY_BACKUP_INVALID' });
        return 3;
      }
    }
    case 'restore:verify': {
      try {
        const fs = await import('node:fs');
        const inPath = typeof flags.input === 'string' ? (flags.input as string) : '';
        if (!inPath || !fs.existsSync(inPath)) {
          out({ command: 'restore:verify', status: 'error', code: 'MASTER_KEY_BACKUP_INVALID' });
          return 2;
        }
        const artifact = JSON.parse(fs.readFileSync(inPath, 'utf8'));
        const wrappingKey = resolveWrappingKey(config);
        const result = verifyConnectorMasterKeyRestore(artifact, wrappingKey, keys.describeKeyring().availableVersions);
        out({ command: 'restore:verify', ...result });
        return result.status === 'PASS' ? 0 : 3;
      } catch {
        out({ command: 'restore:verify', status: 'error', code: 'MASTER_KEY_RESTORE_VERIFICATION_FAILED' });
        return 3;
      }
    }
    case 'drill': {
      // Drill offline com secrets SINTÉTICOS (não toca no banco nem em config real).
      const k1 = randomBytes(32);
      const wrap = randomBytes(32);
      const keyring = buildConnectorMasterKeyring({ primaryVersion: 'v1', keys: { v1: k1.toString('base64') } });
      const artifact = createConnectorMasterKeyBackup({ keyring, wrappingKey: wrap, environment: 'drill', createdAt: new Date().toISOString() });
      const restored = restoreConnectorMasterKeyBackup(artifact, wrap);
      const verify = verifyConnectorMasterKeyRestore(artifact, wrap, ['v1']);
      const ok = restored.primary.version === 'v1' && verify.status === 'PASS';
      out({ command: 'drill', status: ok ? 'PASS' : 'FAIL', checksum: artifact.manifest.checksum, includedKeyVersions: artifact.manifest.includedKeyVersions });
      return ok ? 0 : 3;
    }
    default: {
      out({ status: 'error', code: 'UNKNOWN_SUBCOMMAND', usage: 'status|verify|secrets:verify|reencrypt|backup|restore:verify|drill' });
      return 2;
    }
  }
}

/** Wrapping key do backup — SEPARADA da master key (env dedicada; nunca derivada). */
function resolveWrappingKey(config: ReturnType<typeof loadConfig>): Buffer {
  const b64 = process.env.CONNECTOR_MASTER_KEY_BACKUP_WRAPPING_KEY ?? '';
  const buf = Buffer.from(b64, 'base64');
  if (buf.length !== 32) {
    // Em ausência de wrapping key configurada, o comando de backup/restore não pode operar.
    throw new Error('wrapping key unavailable');
  }
  void config;
  return buf;
}

main()
  .then((code) => process.exit(code))
  .catch(() => {
    out({ status: 'error', code: 'OPERATIONAL_FAILURE' });
    process.exit(1);
  });
