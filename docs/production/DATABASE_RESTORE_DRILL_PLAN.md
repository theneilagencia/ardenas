<!-- Milestone: ARDEN-PRD-001.2A -->
# ARDEN-PRD-001.2A — Plano de restore drill do banco

Plano **proposto** para o ensaio de restauração (gate BLOCKING "Restore drill passed").
**Não executado** nesta fase (sem infra provisionada). Executado em ARDEN-PRD-001.2B, em
ambiente `recovery-drill` isolado de produção.

## Princípio

Um backup só é confiável quando **provado por restauração**. O drill prova a cadeia
completa: **banco restaurado + master key disponível + credencial decifrada**, medindo
RPO/RTO reais em vez de assumir números de marketing.

## Pré-condições

- Backups automatizados + PITR habilitados (`DATABASE_BACKUP_AND_PITR_POLICY.md`).
- Backup cifrado da `CONNECTOR_MASTER_KEY` disponível no secret manager
  (`CONNECTOR_MASTER_KEY_BACKUP_WRAPPING_KEY`) — chave de embrulho **separada**.
- Ambiente `recovery-drill` isolado (rede/credenciais próprias; **sem** acesso a produção).
- Credencial **canário** semeada com token conhecido (não sensível) antes do ponto de restauração.

## Procedimento (proposto)

1. **Marcar T0** e registrar o ponto-alvo de PITR (timestamp).
2. **Restaurar o banco** para um **novo** cluster a partir do PITR no ambiente
   `recovery-drill` (nunca sobre produção).
3. **Restaurar/disponibilizar a master key** da(s) versão(ões) referenciada(s):
   `master-key:restore:verify` (verifica checksum SHA-256 e decifra com a chave de
   embrulho) — confirma que a versão `keyVersion` das credenciais existe no keyring.
4. **Preflight** contra o banco restaurado: `computeConnectorMasterKeyPreflight` sobre as
   `keyVersion` distintas presentes → deve ser `OK` (nenhuma versão ausente).
5. **Decifrar a credencial canário** (resolução server-side) e conferir o token conhecido.
6. **Verificar integridade multi-tenant**: ownership (`organizationId`) das credenciais
   intacto; nenhum plaintext em auditoria/idempotency.
7. **Marcar T1**; calcular **RTO = T1 − T0** e **RPO** (delta entre o ponto restaurado e o
   último dado esperado).
8. **Derrubar** o cluster de drill e revogar credenciais temporárias.

## Evidência obrigatória (campos a registrar)

O relatório do drill (`ARDEN_PRD_001_2B_RESTORE_DRILL_EVIDENCE.md`, criado em 001.2B) deve
conter, no mínimo:

| Campo | Descrição |
| --- | --- |
| `drill_id` | Identificador único do ensaio |
| `executed_at_utc` | Data/hora UTC de execução |
| `environment` | Deve ser `recovery-drill` (nunca `production`) |
| `pitr_target_utc` | Ponto de restauração solicitado |
| `restore_started_utc` / `restore_completed_utc` | Para calcular RTO |
| `measured_rto` / `measured_rpo` | Valores medidos (não assumidos) |
| `master_key_versions_referenced` | Versões `keyVersion` presentes no banco restaurado |
| `master_key_restore_verify` | PASS/FAIL (checksum + decrypt da chave) |
| `preflight_status` | OK / MISSING_VERSIONS / NO_PRIMARY |
| `canary_decrypt` | PASS/FAIL (token canário conferido) |
| `tenant_ownership_intact` | PASS/FAIL |
| `no_plaintext_leak` | PASS/FAIL (auditoria/idempotency sem canário) |
| `operator` | Papel/identidade que executou (workload identity) |
| `result` | PASS / FAIL global |
| `follow_ups` | Itens abertos/decisões |

## Critério de aprovação (gate)

O drill é **PASS** somente se **todos**: restore do banco concluído; `master_key_restore_verify`
PASS; `preflight_status` = OK; `canary_decrypt` PASS; `tenant_ownership_intact` PASS;
`no_plaintext_leak` PASS; e `measured_rto` ≤ alvo (`DATABASE_BACKUP_AND_PITR_POLICY.md`).
Qualquer FAIL → gate **BLOCKING** permanece MISSING; produção bloqueada.

## Estado atual

- **NÃO EXECUTADO** (documental). Requer infra de 001.2B. Gate "Restore drill passed"
  permanece **UNVERIFIED / BLOCKING**.
- O **drill offline da master key** (sem banco) já foi entregue em 001.1
  (`CONNECTOR_MASTER_KEY_DR_DRILL.md`) — este plano estende para o **banco real**.
