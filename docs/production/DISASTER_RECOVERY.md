<!-- Milestone: ARDEN-PRD-001 -->
# ARDEN-PRD-001 — Disaster recovery

Estado atual: **NOT FOUND**. Classificação: **MISSING / P0**.

| Item | Proposta |
| --- | --- |
| RPO | ≤ 15 min (PITR/WAL) — confirmar |
| RTO | ≤ 4 h — confirmar |
| Owner | plataforma (on-call) |
| Backup source | banco gerenciado (PITR) + secret manager |
| Restore target | ambiente isolado de recovery |
| Master key recovery | backup cifrado da `CONNECTOR_MASTER_KEY` no secret manager; quebra-vidro |
| Credential recovery | após restore do banco **e** recuperação da master key, decifrar credenciais |
| DNS failover | conforme provedor (`REQUIRES EXTERNAL DECISION`) |
| Communication | canal de incidente + status page |
| Verification | drill que prova banco + chave + decrypt de credencial |
| Drill cadence | trimestral |

## Cenário crítico explícito
**Recovery do banco SEM a master key NÃO recupera as credenciais.** As credenciais são
ciphertext AES-256-GCM dependente da `CONNECTOR_MASTER_KEY` (`connector-key-provider.ts`).
Portanto:
- A master key é parte **obrigatória** do plano de DR (backup cifrado + recuperação testada).
- Se a master key for perdida de forma irreversível, os tenants precisarão **re-inserir**
  suas credenciais write-only (o produto suporta rotation/create; nada é decifrável do
  backup antigo).
- Este risco é **P0 crítico** e está no `ARDEN_PRD_001_RISK_REGISTER.md`.

## Critério de aceite
DR só é `PASS` após um drill completo (restore de banco + recuperação de master key +
decrypt verificado) documentado com evidência.
