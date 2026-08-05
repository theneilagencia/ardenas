<!-- Milestone: ARDEN-SCOPE-001 -->
# ARDEN-SCOPE-001 — Cobertura de testes (executada)

Executado no commit `756b244`, PostgreSQL 16 local, **banco limpo**.

| Suíte | Arquivos | Testes | Resultado |
| --- | --- | --- | --- |
| Backend unit (`test:api`) | 52 | 555 | PASS |
| Backend integração (`test:api:integration`) | 36 | 267 | PASS |
| Execução+worker integração (`test:api:execution:integration`) | 2 | 10 | PASS |
| Frontend unit + a11y + infra (`test`) | 41 | 305 | PASS |
| Acessibilidade (`test:a11y`) | 3 | 3 | PASS |
| Infra offline (`infra` project) | 1 | 34 | PASS |

## Cobertura qualitativa (o que é comprovado)
- **Cross-tenant denial**: multitenancy + operations-multitenancy + 20+ specs (404/403).
- **Canário de segredo**: vault, external-tool, agentes, webhooks, contratos FE — plaintext
  nunca vaza para DB/auditoria/idempotency/resposta.
- **Recuperação de worker/job preso**: execution-critical §41 (lease expirado).
- **Concorrência**: publish/aprovação/rotação concorrentes → resultado único.
- **Segurança HTTP/SSRF**: timeouts, limites de payload, redirect a IP privado bloqueado.
- **Idempotência + concorrência otimista**: em operações/execuções/agentes/connectors.

## Ressalva de reprodutibilidade
Re-execução da integração sobre banco **contaminado** (re-seed repetido) → 7 falhas em
`identity-authz` por corrida em `prisma/seed.ts:45`. Isolado em banco limpo:
`identity-authz` 22/22 e suíte 267/267. Classificado **GAP-008 (P2, test-harness)**.

## E2E
- Real backend (`e2e/api/`): 3 specs (session, operations, anthropic-admin).
- Demo (`e2e/`): 6 specs. Não re-executados sob esta auditoria (documentais); a evidência
  funcional dos fluxos vem da camada de integração backend (banco real).
