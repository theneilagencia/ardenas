<!-- Milestone: ARDEN-PRD-001.1D -->
# ARDEN-PRD-001.1 — Closeout report (1.1D)

O gate 1.1D fecha os itens operacionais que estavam abertos em 1.1B/1.1C.

## Fechado nesta fase
- **Pipeline PostgreSQL de recriptografia** (CAS, batching, dry-run, idempotência,
  retomada, concorrência, falhas classificadas) — `connector-credential-reencryption.service.ts`
  + adapter Prisma. **Sem migration** (schema já suporta via `keyVersion`).
- **CLI operacional** — `master-key:status/verify/reencrypt/backup/restore:verify/drill`,
  `secrets:verify` (JSON sanitizado, exit codes).
- **Preflight criptográfico compartilhado** (API/worker/CLI) — `ConnectorMasterKeyPreflightService`.
- **Readiness** — `/ready`+`/readyz` incluem o preflight (fail-closed 503, sanitizado);
  liveness (`/health`+`/live`) independente.
- **Worker fail-closed** — não consome jobs com keyring inválido.
- **Testes** — +10 unit + 3 integração PostgreSQL (CAS, plaintext preservado, ownership,
  idempotência, cross-tenant, preflight fail-closed).

## Permanece aberto / fora de escopo (STILL_OPEN)
- Métricas nomeadas exportadas externamente (`arden_connector_master_key_*`) — a
  observabilidade é in-memory (limitação documentada; externalização é PRD-001.4).
- Eventos de auditoria dedicados de recriptografia (nomes propostos) — não persistidos
  nesta fase; a recriptografia é técnica e idempotente (não incrementa versão funcional).
- Teste app-level de perda de chave via `/ready` HTTP (o preflight fail-closed é testado no
  nível de serviço + integração; o teste HTTP end-to-end de missing-key é STILL_OPEN).
- Gate de CI dedicado de recuperação (offline) — recomendado; não adicionado nesta fase.

## Bloqueado por decisão externa / infra (inalterado)
Secret manager de produção; DATABASE_BACKUP (MISSING); PITR; DATABASE_RESTORE_DRILL
(UNVERIFIED); RPO/RTO não aprovados — pertencem ao PRD-001.2.

## Status honesto
`ARDEN-PRD-001.1D: PASS` (itens operacionais principais fechados e testados).
`ARDEN-PRD-001.1`: os P0 de secrets/master-key foram substancialmente fechados; permanece
**PARTIAL** enquanto observabilidade externa, auditoria dedicada e o gate de CI de
recuperação não forem entregues — reportado sem overclaim. Anthropic permanece
DISABLED/bloqueado; nenhuma master key no banco; nenhum endpoint de secret.
