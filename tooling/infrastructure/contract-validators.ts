/**
 * ARDEN-PRD-001.2A.2 — Validadores offline de contratos de IaC e runbooks.
 * Verificam PRESENÇA e FORMA de arquivos não-executáveis. Nenhum provider real, nenhum
 * `terraform`, nenhuma execução de nuvem.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

export interface CheckResult {
  readonly ok: boolean;
  readonly errors: readonly string[];
  readonly checked: number;
}

const REQUIRED_MODULES = [
  'network',
  'compute-api',
  'compute-worker',
  'postgres',
  'secrets',
  'registry',
  'observability',
  'backup',
  'restore-drill',
];

/** Cada módulo de infra deve ter um contract.yaml provider-neutro (inputs/outputs/invariants). */
export function validateInfraContracts(root = 'infra'): CheckResult {
  const errors: string[] = [];
  let checked = 0;
  const modulesDir = resolve(process.cwd(), root, 'modules');
  if (!existsSync(modulesDir)) return { ok: false, errors: [`ausente: ${root}/modules`], checked: 0 };
  for (const mod of REQUIRED_MODULES) {
    const contract = resolve(modulesDir, mod, 'contract.yaml');
    checked++;
    if (!existsSync(contract)) {
      errors.push(`contrato ausente: modules/${mod}/contract.yaml`);
      continue;
    }
    const text = readFileSync(contract, 'utf8');
    for (const section of ['inputs:', 'outputs:', 'invariants:']) {
      if (!text.includes(section)) errors.push(`modules/${mod}/contract.yaml sem seção ${section}`);
    }
    // Proíbe recurso específico de provider ou provider Terraform.
    if (/provider\s+"(aws|google|azurerm)"|resource\s+"aws_|resource\s+"google_/.test(text)) {
      errors.push(`modules/${mod}/contract.yaml contém recurso específico de provider`);
    }
  }
  return { ok: errors.length === 0, errors, checked };
}

const REQUIRED_RUNBOOK_SECTIONS = [
  'Sintomas',
  'Impacto',
  'Diagnóstico',
  'Comandos',
  'Decis',
  'Rollback',
  'Escalon',
  'Evid',
  'Encerr',
];

/** Todos os runbooks listados devem existir e conter as seções obrigatórias. */
export function validateRunbooks(dir = 'docs/runbooks', required: readonly string[] = REQUIRED_RUNBOOKS): CheckResult {
  const errors: string[] = [];
  let checked = 0;
  const base = resolve(process.cwd(), dir);
  if (!existsSync(base)) return { ok: false, errors: [`ausente: ${dir}`], checked: 0 };
  for (const name of required) {
    const path = resolve(base, name);
    checked++;
    if (!existsSync(path)) {
      errors.push(`runbook ausente: ${name}`);
      continue;
    }
    const text = readFileSync(path, 'utf8');
    for (const section of REQUIRED_RUNBOOK_SECTIONS) {
      if (!text.includes(section)) errors.push(`${name} sem seção "${section}"`);
    }
  }
  return { ok: errors.length === 0, errors, checked };
}

export const REQUIRED_RUNBOOKS = [
  'DEPLOY.md',
  'ROLLBACK.md',
  'MIGRATION.md',
  'API_NOT_READY_MASTER_KEY.md',
  'WORKER_NOT_READY_MASTER_KEY.md',
  'DATABASE_UNAVAILABLE.md',
  'POOL_EXHAUSTION.md',
  'BACKUP_FAILURE.md',
  'PITR_FAILURE.md',
  'RESTORE_DRILL.md',
  'PLATFORM_SECRET_MANAGER_OUTAGE.md',
  'CONNECTOR_MASTER_KEY_RECOVERY.md',
  'CROSS_TENANT_SUSPICION.md',
  'SECURITY_INCIDENT.md',
  'BREAK_GLASS.md',
];

/** Verifica que nenhum arquivo do diretório contém curinga de egress ou domínio Anthropic. */
export function validateNoAnthropicAllowlisted(root = 'infra'): CheckResult {
  const errors: string[] = [];
  let checked = 0;
  const walk = (dir: string): void => {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = resolve(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(ya?ml|md|json)$/.test(entry.name)) {
        checked++;
        const text = readFileSync(full, 'utf8');
        // Detecta allowlist que inclua anthropic sem marcar BLOCKED na mesma linha.
        for (const line of text.split('\n')) {
          if (/anthropic|claude\.ai/i.test(line) && /allow|egress.*required/i.test(line) && !/blocked/i.test(line)) {
            errors.push(`possível Anthropic em allowlist: ${entry.name}`);
          }
        }
      }
    }
  };
  walk(resolve(process.cwd(), root));
  return { ok: errors.length === 0, errors, checked };
}
