<!-- Milestone: ARDEN-PRD-001 -->
# ARDEN-PRD-001 — Segurança operacional

## Já implementado (evidência)
- **AuthN/AuthZ:** `apps/api/src/authz/guards/` (authentication, organization, permission,
  active-user). Supabase JWKS + provider fake.
- **Tenant isolation:** `organization.guard.ts`; cross-tenant 404 testado (BE-008 §46).
- **SSRF/egress:** `apps/api/src/connectors/http/ssrf-guard.ts`, `secure-http-client.ts`,
  `connectors/tools/network-policy-runtime.ts`.
- **Vault:** AES-256-GCM (`connectors/vault/`), segredo write-only, sem endpoint de leitura.
- **Config hardening:** `env.schema.ts` (CORS `*` proibido em production; fixture master
  key recusada em production).

## Auditoria de segurança operacional

| Item | Estado | Classificação |
| --- | --- | --- |
| Least privilege (app) | guards de permissão | PARTIAL (revisar roles) |
| IAM de infraestrutura | NOT FOUND | MISSING / P1 |
| Environment isolation | proposto (namespaces de secret) | MISSING (implementar) |
| Admin access / MFA | NOT FOUND (depende do IdP/cloud) | REQUIRES EXTERNAL DECISION |
| Break-glass | NOT FOUND | MISSING / P1 |
| Audit trail (app) | `apps/api/src/audit/` | READY |
| Bastion/VPN, DB privado | NOT FOUND | MISSING / P0 (banco não público) |
| Secret access control | via secret manager (proposto) | MISSING |
| CI/GitHub permissions | branch protection não formalizada | PARTIAL |
| Dependency/vuln scanning | Dependabot ativo no repo (alertas) | PARTIAL (adicionar scanning no CI) |
| Container scanning / SBOM | NOT FOUND | MISSING / P1 |
| Patching | NOT FOUND | MISSING |
| Incident response | ver INCIDENT_RESPONSE | MISSING / P1 |

## Rede (proposta)
TLS obrigatório; **banco privado** (sem exposição pública); outbound restrito por
allowlist; ingress com rate limiting; **egress Anthropic em DENY** em produção neste
estágio; webhook ingress validado (assinatura); proteções SSRF já presentes; comunicação
interna em rede privada. Detalhe em `PRODUCTION_READINESS_ARCHITECTURE.md`.
