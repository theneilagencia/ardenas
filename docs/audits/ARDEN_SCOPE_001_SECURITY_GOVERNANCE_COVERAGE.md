<!-- Milestone: ARDEN-SCOPE-001 -->
# ARDEN-SCOPE-001 — Cobertura de segurança e governança

Score: **95%** (16 requisitos). Verificado por código + testes.

| Controle | Evidência | Status |
| --- | --- | --- |
| Isolamento multi-tenant (defesa em profundidade) | guards + scoping em repositórios; cross-tenant **404** em multitenancy + operations-multitenancy + 20+ specs | COMPLETE |
| Autorização por permissão | PermissionGuard vs permissões computadas no backend; papéis inativos/suspensos não concedem | COMPLETE |
| Cofre de credenciais | AES-256-GCM write-only, AAD por tenant+recurso+keyVersion, fail-closed, crypto-shredding | COMPLETE |
| Keyring versionado + preflight + readiness fail-closed | PRIMARY/DECRYPT_ONLY; `/readyz` 503 sem keyring; worker não consome job | COMPLETE |
| Recriptografia CAS | pipeline PostgreSQL idempotente, concorrência-segura | COMPLETE |
| Platform secret source | catálogo fechado de 5 secrets; produção fail-closed; `value` nunca logado | COMPLETE |
| SSRF guard | resolução DNS de todos A/AAAA + classificação + pinning anti-rebinding; metadata/loopback bloqueados | COMPLETE |
| Auditoria | AuditEvent transacional + IdentityAuditEvent; sanitizados (canário) | COMPLETE |
| Higiene de segredos | sem chave viva commitada; CI secret-scan; redação de logs | COMPLETE |
| Anthropic egress/produção | gates default false; produção bloqueada; egress catalog bloqueia Anthropic | DISABLED (por design) |

**Nenhum SECURITY_RISK aberto** detectado nos caminhos auditados. Sinais `throw new Error`/
`return null` classificados majoritariamente como `INTENTIONAL_FAIL_CLOSED` (ver
`ARDEN_SCOPE_001_PLACEHOLDER_MOCK_REGISTER.md`).
