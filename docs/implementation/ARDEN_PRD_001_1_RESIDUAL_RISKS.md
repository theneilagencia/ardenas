<!-- Milestone: ARDEN-PRD-001.1 -->
# ARDEN-PRD-001.1 — Riscos residuais e itens abertos

## Fechados / reduzidos
- **R-01 (perda de master key):** PARTIALLY_CLOSED — keyring versionado + backup cifrado +
  restore verify + drill offline PASS reduzem o risco; falta backup/restore em infraestrutura
  real (PRD-001.2/1.3) e wiring de CLI.
- **R-05 (secrets sem manager):** PARTIALLY_CLOSED — fronteira neutra + fail-closed de produção
  implementados; adapter de produção depende de decisão externa.

## STILL_OPEN nesta fase
1. Pipeline de recriptografia sobre PostgreSQL (batch/checkpoint/lock/idempotência/retomada).
2. Comandos CLI (`master-key:status/verify/backup/restore:verify/reencrypt/drill`, `secrets:verify`).
3. Wiring do preflight do keyring ao `/ready` e à readiness do worker (fail-closed em app).
4. Eventos de auditoria (`connector_master_key.*`) e métricas nomeadas (`arden_connector_master_key_*`).
5. Injeção NestJS (module) do `PlatformSecretSource` e do keyring formal.
6. Migration aditiva opcional para checkpoint de recriptografia (documentar antes de criar).
7. Testes de integração com PostgreSQL + teste crítico de perda de chave em nível de app.
8. Gates de CI dedicados (offline, canários sintéticos).

## BLOCKED_BY_EXTERNAL_DECISION
- Escolha do secret manager de produção (`REQUIRES_EXTERNAL_DECISION`).
- DATABASE_BACKUP / PITR / restore drill real (dependem de banco gerenciado — PRD-001.2).

## Invariantes mantidas
Anthropic DISABLED/bloqueado; nenhuma master key no banco; nenhum endpoint de secret;
nenhum secret real no repositório; migrations anteriores intactas.
