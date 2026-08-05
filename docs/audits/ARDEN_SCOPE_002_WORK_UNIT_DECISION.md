<!-- Milestone: ARDEN-SCOPE-002 -->
# ARDEN-SCOPE-002.3 — Decisão de modelagem de Work Unit

## Investigação (fontes canônicas + código)
A auditoria afirmou "Work Unit não tem entidade dedicada". Verificação factual:

- **Não existe** entidade/campo `WorkUnit`/`workUnit` no `schema.prisma` (grep = 0).
- No **frontend**, "Work Unit" é um **livro-razão de orçamento/consumo**: `WorkUnitLedger`
  + `WorkUnitRequest` (`src/services/contracts.ts`), página `/work-units` gated por
  `budget.view`, alerta em 85% de uso. É um conceito de **cota/orçamento**, não de execução.
- `Operation.workUnits` é um **número** (orçamento). `Execution.workUnitsUsed`/`budgetDebited`
  são **consumo por execução**.
- **Não há** documento canônico (`docs/frontend`,`docs/backend`) definindo Work Unit como
  entidade persistente exigida.

## Decisão: **C. SUPERSEDED_BY_EXISTING_AGGREGATE**

A função de **contabilidade de work-unit** (custo/consumo por execução) já é canônica e
está **COMPLETE e testada** pelos agregados existentes:
- **ExecutionRun/ExecutionStep** — unidade de execução + estado + custo por etapa;
- **AgentModelCallUsage / AgentToolCallUsage / AgentUsageRollup** — uso por chamada + rollups;
- **ModelRateCard** — custo estimado (ou `null` quando ausente, nunca zero fabricado).

Evidência de teste: `agent-governance.integration.spec §42/§43/§44`, `execution-flow.spec`.

**Não** se cria entidade `WorkUnit` dedicada porque:
- Nenhuma fonte canônica a exige (§12: "não criar apenas para satisfazer nomenclatura").
- Duplicaria dados já persistidos em `ExecutionRun`/usage (§14: "não duplicar").

## Consequência para a rastreabilidade
- **SCOPE-WU-001** (contabilidade de work-unit) reclassificado **PARTIAL → COMPLETE** com
  evidência de supersessão (agregados de execução/uso). **Não** é remoção para inflar
  percentual (§3): o requisito permanece contado; apenas seu status reflete a realidade
  comprovada.
- **SCOPE-WU-002** (UI `/work-units`, livro-razão de orçamento) permanece **MOCK_ONLY**
  (rota demo — Exclusão A). Opcional, não bloqueante.

## Não implementado (por decisão)
Entidade WorkUnit, migração, CRUD e API dedicada — **não** exigidos. Caso uma decisão
futura defina Work Unit como agregado próprio, isto vira um novo requisito (não retroativo).
