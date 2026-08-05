<!-- Milestone: ARDEN-PRD-001.2A.2 -->
# Protocolo de validação de restore (independente de fornecedor)

Validações a executar contra um banco restaurado em `recovery-drill` (nunca produção):

1. conexão **TLS**;
2. versão PostgreSQL (16);
3. `migrate status` (up to date);
4. tabelas essenciais presentes;
5. contagens sanitizadas;
6. integridade referencial;
7. **keyring preflight** (`computeConnectorMasterKeyPreflight` = OK);
8. **decrypt de credencial sintética** (canário) com a versão referenciada;
9. **tenant isolation** (ownership por organizationId intacto);
10. **worker desabilitado** no ambiente de drill;
11. integrações externas **bloqueadas**;
12. **Anthropic bloqueado**.

PASS exige todos. Estende `DATABASE_RESTORE_DRILL_PLAN.md` (banco + master key + decrypt).
Campos de evidência: ver `planRestoreDrill` em `tooling/infrastructure/database-recovery.ts`.
