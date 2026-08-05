<!-- Milestone: ARDEN-SCOPE-001 -->
# ARDEN-SCOPE-001 — Cobertura de backend

27 controllers · 99 services · 23 módulos · 48 modelos Prisma · 11 migrations. Guards
globais em ordem: Authentication → ActiveUser → Organization (tenant + permissões +
anti-enumeração 404) → Permission (`@RequirePermission`). Isolamento reaplicado em cada
repositório (`where: { organizationId }`).

| Domínio | Persistência real | Auth/Tenant | Testes | Status |
| --- | --- | --- | --- | --- |
| operations (+versions, authority) | Operation/OperationVersion (+ cascata publish) | sim | operations-flow/lifecycle/multitenancy/rollback | COMPLETE |
| policies (+bindings) | Policy/PolicyVersion/OperationPolicyBinding | sim | policies-flow | COMPLETE |
| approvals + enforcement | ApprovalFlow/Request/Decision/Delegation, ActionAuthorization | sim | enforcement-flow, approval-concurrency | COMPLETE |
| executions (engine+queue+worker+jobs) | ExecutionRun/Step/Attempt/Event/Job/Evidence | sim (worker fail-closed) | execution-flow, execution-critical | COMPLETE |
| connectors (catalog/connections/credentials/tool-bindings/webhooks/ssrf) | 8 modelos + vault | sim | 7 specs (vault-critical, external-tool, secure-http, webhook-inbound…) | COMPLETE |
| agents (agents/versions/model-config/providers/governance/runtime) | 11 modelos | sim | 10 specs | COMPLETE (runtime comercial gated) |
| organizations | Membership/Organization | self-scoped | multitenancy | COMPLETE |
| session | UserSessionPreference | authenticated | identity-authz, multitenancy | COMPLETE |
| identity | User/IdentityAuditEvent (JIT) | fundação | fake/supabase provider, identity-authz | COMPLETE |
| audit | AuditEvent (read API) + IdentityAuditEvent | sim | operations-multitenancy (no-leak) | COMPLETE |
| health | ping + keyring preflight (503 fail-closed) | public | app.integration | COMPLETE |
| meta / docs | metadados estáticos + OpenAPI | public | app.integration | NOT_APPLICABLE (estático) |

**Não encontrados:** endpoint sem persistência real, service placeholder, módulo não
registrado, ou código de produção alcançável só em teste. **Ressalva única:** o provider
comercial Anthropic é registrado apenas quando `ANTHROPIC_PROVIDER_RUNTIME_ENABLED &&
NODE_ENV!=='production'`; em produção só o provider determinístico interno executa
(design). Duas tabelas de auditoria (`AuditEvent` vs `IdentityAuditEvent`); a API de
leitura expõe apenas a primeira.
