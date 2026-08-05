<!-- Milestone: ARDEN-PRD-001.2A.2 -->
# Contratos de IAM neutros (capacidades abstratas)

Fonte executável: `tooling/infrastructure/iam-contracts.ts` (menor privilégio checado por
teste). Nenhuma política AWS/GCP/Azure criada.

| Identidade | Capacidades | Lê secrets | Banco |
| --- | --- | --- | --- |
| api-runtime | ler secrets de runtime, conectar, logs, métricas | DATABASE_URL, MASTER_KEY_PRIMARY, SESSION_JWT_MATERIAL, OBSERVABILITY_TOKEN | runtime (pooler) |
| worker-runtime | idem + consumir fila | DATABASE_URL, MASTER_KEY_PRIMARY, OBSERVABILITY_TOKEN | runtime (pooler) |
| migration-job | migrations via conexão direta | DATABASE_URL | **direto** (DIRECT_URL) |
| ci-deployer | push de imagem (OIDC curto), trigger deploy | — | — |
| backup-operator | gerir backups/retenção/PITR | — | — |
| restore-operator | restaurar em cluster isolado; ler wrapping key (drill) | MASTER_KEY_BACKUP_WRAPPING_KEY | direto |
| break-glass | acesso elevado temporário (MFA+2 aprovações+auditado) | — | — |

## Invariantes (teste)
- runtime **nunca** lê a wrapping key de backup; só o restore-operator lê.
- migration-job usa conexão **direta** (não runtime).
- ci-deployer não lê segredos de runtime.
