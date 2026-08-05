<!-- Milestone: ARDEN-PRD-001 -->
# ARDEN-PRD-001 — Runbook de migrations em produção

## Estado atual
`prisma migrate deploy` / `migrate status` disponíveis (`apps/api/package.json`). 11
migrations aditivas; nenhuma anterior editada no ARDEN-BE-008. **Sem** runbook de
zero-downtime, gate de execução ou rollback documentado. Classificação: **PARTIAL**.

## Procedimento proposto
```
preflight → backup/checkpoint → migration compatibility → migrate deploy (gate único) →
verification → application rollout → post-check
```

1. **Preflight:** `migrate status` (sem drift); revisar SQL; confirmar backup recente.
2. **Backup/checkpoint:** snapshot/PITR marker antes de aplicar (ver `BACKUP_AND_RESTORE.md`).
3. **Compatibility (expand/contract):** toda migration deve ser **backward-compatible** com
   a versão da aplicação atualmente em execução (deploy é rolling).
   - *Expand:* adicionar coluna/tabela/índice nullable → deploy app → backfill → *contract*
     (remover o antigo) numa migration posterior.
4. **Execução:** migration roda **uma vez**, num **gate separado** — **NUNCA** no entrypoint
   de todas as réplicas (evita corrida). Job dedicado com lock.
5. **Verification:** `migrate status` up-to-date; smoke em `/ready`.
6. **Rollout:** subir a nova versão da aplicação.
7. **Post-check:** métricas de erro/latência estáveis.

## Regras
- Timeout/lock: migrations longas (índices) usam `CONCURRENTLY` quando possível.
- **Migrations irreversíveis** (drop de coluna) só na fase *contract*, após o app não usar
  mais o campo.
- Rollback: preferir *roll-forward*; se necessário, restaurar do backup + redeploy da
  imagem anterior (a imagem anterior deve ser compatível com o schema anterior).
- Seed: idempotente (`db:seed` ×2 = `+0`); **fixture E2E não entra no seed de produção**.
- Ownership: dono do release executa o gate; segurança revisa migrations sensíveis.
