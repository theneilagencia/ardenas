<!-- Milestone: ARDEN-PRD-001.2A.2 -->
# Manifesto de decisão de produção

Ponto único de entrada das decisões humanas pendentes. Provider-neutro; nenhum valor
preenchido nesta fase.

- **Exemplo:** `config/infrastructure/production-decision.example.yaml` (todos os campos
  bloqueantes em sentinela: `TBD` / `REQUIRES_APPROVAL` / `REQUIRES_QUOTE` /
  `REQUIRES_LEGAL_REVIEW`).
- **Schema/validação:** `tooling/infrastructure/decision-manifest.ts` (zod + avaliação de
  prontidão fail-closed).
- **Real (preenchido):** `config/infrastructure/production-decision.yaml` — **git-ignored**,
  criado só quando houver decisão + evidência. Nunca contém segredo.

## Campos bloqueantes
provider · primaryRegion · orçamentos (staging/pilot/production) + currency · SLA + suporte ·
RPO/RTO · produtos (postgres/secret-manager/api/worker/registry/observability) · referências
de aprovação (legal/DPA/business/technical) · operationsOwner · adrStatus (ACCEPTED) · datas.

## Validação
`npm run infrastructure:decision:validate` → **FAIL** enquanto qualquer bloqueante for
sentinela ou a ADR não for ACCEPTED. Nenhum bypass. Ver `ARDEN_PRD_001_2B_ENTRY_GATE.md`.
