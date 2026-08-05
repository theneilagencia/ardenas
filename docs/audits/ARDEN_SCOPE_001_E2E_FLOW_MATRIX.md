<!-- Milestone: ARDEN-SCOPE-001 -->
# ARDEN-SCOPE-001 — Matriz de fluxos E2E

32 fluxos (30 obrigatórios + cross-tenant + Anthropic live). Fonte:
`arden-scope-001-e2e-flows.json`. **30 PASS · 1 PARTIAL · 1 BLOCKED_BY_EXTERNAL_PROVIDER.**
"Executado" = existe teste que comprova o fluxo (integração/E2E) e passa em banco limpo.

| Flow | Status | Evidência |
| --- | --- | --- |
| autenticação | PASS | identity-authz + e2e/api/session-api |
| seleção de tenant | PASS | multitenancy + switch-organization + e2e/session-tenant |
| criação de operação | PASS | operations-flow + e2e/api/operations-api |
| criação de versão | PASS | operations-lifecycle + version-diff |
| configuração de autoridade | PASS | enforcement-flow + authority-evaluation (backend) |
| configuração de policy | PASS | policies-flow |
| solicitação de aprovação | PASS | enforcement-flow |
| aprovação humana | PASS | enforcement-flow + approval-concurrency |
| publicação | PASS | operations-flow + operations-rollback + e2e/api |
| criação de connector | PASS | connections-api + connectors-persistence |
| armazenamento de credential | PASS | credential-vault |
| rotação de credential | PASS | credential-vault(+critical) |
| criação de agent | PASS | agents-persistence |
| criação de ModelConfiguration | PASS | agents-persistence + ModelConfigurationsPage.test |
| criação/publicação de AgentVersion | PASS | agents-persistence + agents-critical §32/§33 |
| criação de Work Unit | PARTIAL | execution-flow (workUnitCost em etapa; sem entidade dedicada) |
| início de ExecutionRun | PASS | execution-flow + execution-critical |
| processamento pelo worker | PASS | execution-flow + webhook-inbound |
| execução de agent | PASS | agent-runtime §35 |
| execução de tool | PASS | agent-tool-calling + external-tool |
| retomada após aprovação | PASS | agent-tool-calling §38 + execution-critical §42 |
| persistência do resultado | PASS | agent-governance + execution-flow |
| auditoria | PASS | operations-multitenancy + e2e/api/operations-api |
| evidence | PASS | execution-flow + agent-runtime §35 |
| usage | PASS | agent-governance §42 |
| custo (ou ausência explícita) | PASS | agent-governance §42 (rate-card ausente → null) |
| retry | PASS | execution-flow + external-tool + anthropic-runtime §51 |
| timeout | PASS | secure-http-client + external-tool + anthropic-runtime §52 |
| restart do worker | PASS | execution-critical §41 |
| recuperação de job preso | PASS | execution-critical §41 (mesmo mecanismo de lease) |
| cross-tenant denial | PASS | multitenancy + operations-multitenancy + 20+ specs + e2e/api |
| **Anthropic live call** | **BLOCKED_BY_EXTERNAL_PROVIDER** | não executado; fake transport em teste; produção bloqueada |

> Observações: os fluxos são comprovados majoritariamente na **camada de integração/backend**
> (banco real). A cobertura **E2E de UI real (modo api)** limita-se a 3 rotas; a maioria das
> telas não-núcleo é demonstração (ver `ARDEN_SCOPE_001_FRONTEND_COVERAGE.md`). Fluxos 29 e 30
> compartilham o mesmo mecanismo de recuperação por lease.
