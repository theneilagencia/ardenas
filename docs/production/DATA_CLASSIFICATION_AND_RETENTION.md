<!-- Milestone: ARDEN-PRD-001 -->
# ARDEN-PRD-001 — Classificação de dados e retenção

Estado atual: classificação/retenção formais **NOT FOUND** (exceto TTL de idempotência em
`apps/api/src/modules/idempotency/idempotency.service.ts`). Classificação: **MISSING / P1**.
Nenhuma exclusão é implementada nesta auditoria.

## Classificação (proposta)
`PUBLIC` · `INTERNAL` · `CONFIDENTIAL` · `RESTRICTED` · `SECRET`

| Dado | Classe | Armazenamento | Logging | Retenção proposta |
| --- | --- | --- | --- | --- |
| Usuário (perfil) | CONFIDENTIAL | banco | sem PII em log | vida da conta + prazo legal |
| Tenant/org | CONFIDENTIAL | banco | id apenas | vida da org |
| Operations | INTERNAL | banco | id | conforme política do tenant |
| Execution input | RESTRICTED | banco | nunca cru | retenção curta configurável |
| Execution output | RESTRICTED | banco | nunca cru | idem |
| Evidence | RESTRICTED | banco/refs | referência apenas | retenção de auditoria |
| Audit | CONFIDENTIAL | banco | evento sanitizado | ≥ período legal |
| Credentials | SECRET | vault (ciphertext) | **nunca** | vida da credencial |
| Logs | INTERNAL/CONFIDENTIAL | agregador | redação aplicada | 30–90 dias |
| Metrics | INTERNAL | provedor | sem PII | conforme provedor |
| Prompts/context | RESTRICTED | não persistido cru (BE-008) | nunca | não retido |
| Tool payloads | RESTRICTED | sanitizado | nunca cru | curto |

## Retenção e exclusão (a definir na implementação)
Distinguir `soft delete` · `hard delete` · `retention` · `legal hold` · `backup expiry`.
Escopos a cobrir: executions, audit, evidence, files, webhooks, connector logs, model
usage, cost data, credentials, tenants excluídos, backups. **Exclusão de tenant** deve
propagar (soft→hard após período), respeitando legal hold e expiração de backup.
