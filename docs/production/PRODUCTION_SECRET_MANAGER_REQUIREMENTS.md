<!-- Milestone: ARDEN-PRD-001.1A -->
# ARDEN-PRD-001.1A — Requisitos do secret manager de produção

`PRODUCTION_SECRET_MANAGER_DECISION: REQUIRES_EXTERNAL_DECISION` (nenhum fornecedor escolhido).

Requisitos que o adapter de produção (`PlatformSecretSource` externo) deve satisfazer:
- injeção em runtime (sem `.env` em produção); rotação e revogação de secrets;
- auditoria de acesso; acesso mínimo (least privilege); separação por ambiente (namespaces);
- break-glass com auditoria; alta disponibilidade (indisponibilidade → fail-closed, não
  fallback); backup cifrado do próprio secret store; suporte a versões (para a wrapping key
  e material de plataforma).
- **Nunca** aceitar a fixture de teste (`WELL_KNOWN_TEST_MASTER_KEYS`) em produção.

Candidatos (sem decisão): AWS Secrets Manager, GCP Secret Manager, HashiCorp Vault, Azure
Key Vault. A escolha pertence ao dono do produto/infra e deve ser registrada em arquivo
versionado antes de implementar o adapter (`PRODUCTION_SECRET_MANAGER_DECISION: SELECTED`).
