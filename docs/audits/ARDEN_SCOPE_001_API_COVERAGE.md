<!-- Milestone: ARDEN-SCOPE-001 -->
# ARDEN-SCOPE-001 — Cobertura de API

OpenAPI v1: **98 paths** (`docs/api/openapi-v1.yaml`), gerado dos contratos —
`contracts:openapi` sem drift. Cliente TS gerado (`src/services/api/generated`) + testes de
compatibilidade por domínio.

| Métrica | Valor |
| --- | --- |
| API_IMPLEMENTATION_COVERAGE | ALTA — todos os controllers auditados possuem service+persistência real |
| OPENAPI_COVERAGE | 98 paths cobrindo session/orgs/operations/versions/authority/policies/approvals/enforcement/executions/connectors/credentials/webhooks/agents/versions/model-configs/providers/results/usage/audit/health/meta |
| GENERATED_CLIENT_COVERAGE | Cliente gerado com testes `*-client-compat.test.ts` (agents/connectors/execution/governance/base) |
| FRONTEND_API_COVERAGE | PARCIAL — cliente cobre todos os domínios, porém o frontend só **consome** operations/audit/connectors/agents; executions/approvals/authority/policies não são chamados pela UI |

## Divergências
- **Endpoint implementado ausente do OpenAPI:** nenhum detectado (OpenAPI é gerado dos contratos).
- **Endpoint no OpenAPI sem controller:** nenhum detectado.
- **Endpoint sem consumidor (frontend):** executions, approval-flows/requests/delegations,
  authority, policies/governance — backend real, sem chamada da UI (GAP-002/003/004).
- **Segredo em resposta:** nenhum — canário `secret-canary.contract.test.ts` + specs de
  vault comprovam ausência de plaintext.
- **Erro não documentado / cliente desatualizado / payload antigo:** não detectados.
