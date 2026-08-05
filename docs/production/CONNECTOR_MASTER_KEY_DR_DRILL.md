<!-- Milestone: ARDEN-PRD-001.1C -->
# ARDEN-PRD-001.1C — Drill de recuperação (offline)

Drill automatizado e offline em `connector-master-key-lifecycle.spec.ts`
("DRILL offline completo de recuperação"), usando **apenas secrets sintéticos**.

## Fluxo (§27) — PASS
```
gerar keyring K1 → cifrar credential canário → criar backup cifrado →
remover keyring ativo (simulado) → restaurar em memória isolada →
validar keyring restaurado → decifrar credential canário →
adicionar K2 → promover K2 → recriptografar credential → comprovar leitura →
comprovar elegibilidade de remoção de K1 após zero referências
```

## Canários sintéticos
`ARDEN_PRD001_MASTER_KEY_CANARY_*` · `ARDEN_PRD001_CONNECTOR_SECRET_CANARY_*` ·
`ARDEN_PRD001_BACKUP_WRAPPING_CANARY_*`. Comprovado: os canários **não** aparecem no artefato
de backup (dump) nem no relatório sanitizado.

## Evidência do drill
timestamp/commit fornecidos pelo runner de CI; ambiente = "drill"; formato = v1; versões
fictícias v1/v2; checksum SHA-256; 1 credencial canário; restore PASS; recriptografia OK;
canários ausentes do artefato; status PASS. **Não** registra keys, plaintext, ciphertext
integral, wrapping key ou credential integral.

## Database restore
`DATABASE_BACKUP: MISSING` · `DATABASE_RESTORE_DRILL: UNVERIFIED` até um ambiente real ser
restaurado (fora desta fase — depende de banco gerenciado, ARDEN-PRD-001.2).
