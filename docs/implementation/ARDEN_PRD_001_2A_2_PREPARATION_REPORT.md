<!-- Milestone: ARDEN-PRD-001.2A.2 -->
# ARDEN-PRD-001.2A.2 — Relatório de preparação técnica

Deixa o repositório tecnicamente pronto para implementar a infraestrutura **após** a
decisão humana, sem nova fase de descoberta/redesenho. Provider-neutro; nenhum recurso
criado; nenhum fornecedor selecionado; ADR permanece PROPOSED.

## Entregas (código offline, provider-neutro)
- **Manifesto de decisão** + schema + validador fail-closed:
  `config/infrastructure/production-decision.example.yaml`,
  `tooling/infrastructure/decision-manifest.ts`, `manifest-io.ts`.
- **Entry-gate validator**: `npm run infrastructure:decision:validate` (FAIL controlado).
- **IaC contracts**: `infra/` (README + contracts + environments + 9 módulos com
  inputs/outputs/invariants). Validadores: `infrastructure:contracts:validate`,
  `infrastructure:environments:validate`.
- **Connection budget**: `connection-budget.ts` (BLOCKED sem limite).
- **Artifact manifest**: `artifact-manifest.ts` + `artifact:build`/`artifact:verify` (por SHA; sem latest; sem secret).
- **Deploy/migração fail-closed**: `infra.cli.ts` (deploy:*, `production:migrate`) — exigem manifesto aprovado.
- **Smoke suite**: `smoke.ts` (URL obrigatória; nunca Anthropic; default não executa).
- **Recovery adapter**: `database-recovery.ts` (interface + adapter FAIL-CLOSED) + `RESTORE_VALIDATION_PROTOCOL.md`.
- **IAM neutro**: `iam-contracts.ts` (menor privilégio testado) — `infrastructure:iam:validate`.
- **Rede/egress**: `network-catalog.ts` (Anthropic/internet BLOCKED; default DENY).
- **Alertas machine-readable**: `config/infrastructure/alert-definitions.json` (19) + validador.
- **Runbooks**: 15 (11 novos + 4 padronizados) — `infrastructure:runbooks:validate`.
- **DATABASE_URL/DIRECT_URL**: separação no `schema.prisma` + `env.schema.ts` + `setup-env.ts`
  + CI + docker-compose + testes de config. **Sem migration criada.**
- **CI offline**: job `infrastructure` (validadores + testes infra + artifact + entry gate bloqueado). Sem cloud login/secret/deploy.

## Documentos
17 em `docs/production/` + 3 em `docs/implementation/`; 8 atualizados. Ver §30 do prompt.

## Invariantes mantidos
Anthropic **DISABLED**; `productionAllowed=false`; sem secret no repo; master key nunca no
banco; sem endpoint HTTP de secrets; nenhum fornecedor/região selecionado; ADR **PROPOSED**;
`ARDEN_PRD_001_2B_ENTRY_GATE = FAIL`; 001.2B **não iniciado**.

Commit de referência: `622c39c04688f5a2d610f16f19f768cd5b56853e`.
