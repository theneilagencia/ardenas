<!-- Milestone: ARDEN-PRD-001.2A -->
# ARDEN-PRD-001.2A — Secret manager: análise das opções

Fatos remetem a S3 do `ARDEN_PRD_001_2A_SOURCE_REGISTER.md`. A escolha implementa **um
adapter** do contrato **já existente** — não redesenha o contrato.

## Contrato existente (não muda)

`apps/api/src/security/platform-secret-source.ts` (ARDEN-PRD-001.1) define:

- Catálogo **fechado** `PLATFORM_SECRET_NAMES`: `DATABASE_URL`,
  `CONNECTOR_MASTER_KEY_PRIMARY`, `CONNECTOR_MASTER_KEY_BACKUP_WRAPPING_KEY`,
  `SESSION_JWT_MATERIAL`, `OBSERVABILITY_TOKEN`.
- Interface neutra `PlatformSecretSource` → `getRequiredSecret` / `getOptionalSecret` →
  `ResolvedPlatformSecret { value, version?, source }` (`source` ∈ `ENVIRONMENT` |
  `EXTERNAL_SECRET_MANAGER`).
- `EnvironmentPlatformSecretSource` — **apenas** local/test/CI.
- `createPlatformSecretSource` — factory **fail-closed**: em produção, origem
  `environment` só é aceita se explicitamente aprovada; origem `external` sem adapter →
  startup **falha**.

**O secret manager de produção é uma implementação de `PlatformSecretSource` com
`source = 'EXTERNAL_SECRET_MANAGER'`.** Não há mudança de contrato. Nenhum endpoint HTTP
de secrets. `value` nunca é logado/persistido.

## Requisitos do secret manager (derivados do produto)

1. Armazenar os 5 secrets do catálogo fechado, cifrados em repouso.
2. **Versionamento** de secret (mapear para `ResolvedPlatformSecret.version`) — essencial
   para o `CONNECTOR_MASTER_KEY_PRIMARY` (keyring versionado) e rotação sem downtime.
3. **Acesso mínimo por identidade de workload** (API/worker leem só o que precisam; ver
   `INFRASTRUCTURE_IAM_MODEL.md`).
4. **Rotação** suportada (ou automatizável) — o `SESSION_JWT_MATERIAL` e a wrapping key.
5. **Auditoria de acesso** (quem leu qual secret e quando).
6. **Separação forte** entre `CONNECTOR_MASTER_KEY_PRIMARY` e
   `CONNECTOR_MASTER_KEY_BACKUP_WRAPPING_KEY` (papéis/identidades distintos — a wrapping
   key de backup nunca é lida pela mesma identidade que usa a primária em runtime).

## Comparação

| Critério | AWS Secrets Manager (A) | GCP Secret Manager (B) | Azure Key Vault (C) | HashiCorp Vault / Doppler / Infisical (D) |
| --- | --- | --- | --- | --- |
| Versionamento | Sim — S3.1 | Sim (versões) — S3.2 | Sim — S3.3 | Sim — S3.4 |
| IAM por segredo | Sim (policy no nível do segredo) — S3.1 | Sim (IAM por segredo) — S3.2 | RBAC no nível do cofre — S3.3 | Políticas por caminho — S3.4 |
| Workload identity | IAM roles / IRSA | Workload Identity — S3.2 | Managed Identity — S3.3 | AppRole/OIDC/K8s auth |
| Rotação automatizada | Sim (Lambda) — S3.1 | Via automação — S3.2 | Via automação/eventos — S3.3 | Rotação dinâmica — S3.4 |
| Auditoria de acesso | CloudTrail | Cloud Audit Logs | Azure Monitor | Audit devices |
| Acoplamento | AWS | GCP | Azure | Portátil (multi-cloud) |
| Adapter a implementar | `EXTERNAL_SECRET_MANAGER` | idem | idem | idem |

## Decisão

- **Alinhar o secret manager ao provedor de compute/banco escolhido** (A→Secrets Manager,
  B→Secret Manager, C→Key Vault) para usar **workload identity nativa** (sem chaves de
  serviço exportadas) — princípio de menor privilégio mais forte.
- Se o compute for **PaaS especializado (D)**, usar um secret manager **portátil**
  (HCP Vault / Doppler / Infisical) ou o secret store nativo do PaaS **desde que** ofereça
  versionamento + acesso mínimo + auditoria; validar antes de assumir.
- **Não** escolher fornecedor aqui sem a decisão de plataforma (ADR-0001) — a escolha do
  secret manager é **consequência** da escolha de plataforma, não independente.

## Itens de IMPLEMENTAÇÃO (ARDEN-PRD-001.2B — não feitos nesta fase)

1. Implementar o adapter `EXTERNAL_SECRET_MANAGER` do provedor escolhido (satisfaz
   `PlatformSecretSource`; `value` nunca logado; mapeia `version`).
2. Provisionar os 5 secrets do catálogo; conceder leitura por workload identity mínima.
3. Separar identidade da wrapping key de backup da identidade de runtime.
4. Ativar auditoria de acesso e alerta em leitura anômala.
5. Testar rotação de `SESSION_JWT_MATERIAL` e da wrapping key sem downtime.

## Estado atual

- Fronteira + fail-closed + factory: **entregues** (001.1). Adapter de produção:
  **BLOCKED_BY_EXTERNAL_DECISION** (depende do ADR-0001). Gate "Secrets managed" permanece
  **BLOCKING / PARTIALLY_CLOSED**.
