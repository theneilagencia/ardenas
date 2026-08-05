<!-- Milestone: ARDEN-PRD-001 -->
# ARDEN-PRD-001 — Backup e restore

## Estado atual
**NOT FOUND.** Não há backup, PITR, restore ou drill no repositório. Classificação:
**MISSING / P0**. Um backup **não é comprovado até o restore ser executado**.

```
Backup status: UNVERIFIED até restore drill PASS
```

## Definição proposta

| Item | Proposta |
| --- | --- |
| Frequência | snapshot diário + WAL contínuo (PITR) via banco gerenciado |
| Retenção | 30 dias PITR + snapshots mensais por período legal (`REQUIRES EXTERNAL DECISION`) |
| Criptografia | at-rest no provedor + backup do secret manager cifrado |
| PITR | habilitado (janela ≥ 7 dias) |
| Cross-region | recomendado para produção comercial (`REQUIRES EXTERNAL DECISION`) |
| Restore environment | ambiente isolado dedicado a drills |
| Restore drills | cadência trimestral; evidência registrada |
| RPO | alvo ≤ 15 min (PITR/WAL) — a confirmar |
| RTO | alvo ≤ 4 h para banco — a confirmar |
| Evidence | log de cada drill (timestamp, ponto restaurado, verificação) |

## Escopo além do banco
O restore do **banco** não recupera credenciais sem a **`CONNECTOR_MASTER_KEY`**. O plano
de backup DEVE incluir o backup cifrado da master key (secret manager) e o teste de que,
após restore de banco + recuperação da chave, as credenciais cifradas decifram. Ver
`SECRETS_AND_KEY_MANAGEMENT.md` e `DISASTER_RECOVERY.md`.

## Critério de aceite
`Backup status: PASS` só quando um **restore drill completo** (banco + master key + decrypt
de credencial) for executado e verificado num ambiente isolado. Até lá: **UNVERIFIED**.
