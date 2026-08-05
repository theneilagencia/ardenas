<!-- Milestone: ARDEN-PRD-001.1 -->
# ARDEN-PRD-001.1 — Relatório de implementação (secrets + master-key lifecycle)

## Entregue (implementado + testado)
- **Platform secret source** (`apps/api/src/security/platform-secret-source.ts`): catálogo
  fechado, contrato neutro, adapter de ambiente (local/test/CI), fábrica **fail-closed** de
  produção. Separa platform secrets de tenant-managed secrets.
- **Keyring versionado** (`connector-master-keyring.ts`): PRIMARY/DECRYPT_ONLY, invariantes
  validadas, `resolveKeyForVersion` fail-closed, `preflightKeyring` sanitizado,
  `keyRemovalEligibility` (report-only).
- **Backup/restore cifrado** (`connector-master-key-backup.ts`): artefato AES-256-GCM com
  wrapping key SEPARADA, checksum SHA-256, restore verify em isolamento, fail-closed.
- **Rotação + backward-decrypt + drill offline completo** comprovados por 30 testes unit.
- **Formato criptográfico preservado** (AES-256-GCM de BE-006.4; nenhum ciphertext quebrado;
  nenhuma migration; nenhuma chave no banco; nenhum endpoint de secret).

## Gate status
- **ARDEN-PRD-001.1A (inventário/decisão):** PASS — catálogo, separação platform/tenant,
  `PRODUCTION_SECRET_MANAGER_DECISION: REQUIRES_EXTERNAL_DECISION`, contrato neutro.
- **ARDEN-PRD-001.1B (secret loading + keyring lifecycle):** PARTIALLY_CLOSED — núcleo puro
  (secret source, keyring, preflight, rotação/backward-decrypt, eligibility) IMPLEMENTED +
  tested. **STILL_OPEN:** wiring do preflight ao `/ready` e worker readiness; pipeline de
  recriptografia sobre o banco (batch/checkpoint/concorrência + integração PostgreSQL);
  comandos CLI; eventos de auditoria + métricas nomeadas; injeção via NestJS module.
- **ARDEN-PRD-001.1C (backup/restore/drill):** PARTIALLY_CLOSED — backup cifrado, restore
  verify e **drill offline PASS** IMPLEMENTED + tested. **STILL_OPEN/NOT CLAIMED:** production
  restore; DATABASE_BACKUP/PITR/restore drill real (dependem de banco gerenciado, PRD-001.2);
  comandos CLI de backup/drill.

## Overall
**ARDEN-PRD-001.1: NOT PASS (PARTIAL).** A fundação criptográfica de secrets/keyring/backup
que reduz os P0 de maior risco (R-01 perda de master key, R-05 secrets) foi implementada e
testada, mas a integração de banco/CLI/readiness e a matriz de integração completa exigidas
pelos critérios de aceite §46 **não** foram concluídas nesta execução. Reportado com
honestidade; nada é falsamente declarado como pronto.

## Invariantes preservadas
Anthropic permanece DISABLED / `productionAllowed=false` / live NOT EXECUTED. Nenhum secret
real commitado; nenhuma master key no PostgreSQL; nenhum endpoint HTTP de secret; migrations
anteriores intactas; cross-tenant não regride (código de cofre inalterado).
