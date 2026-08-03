# UI de resultados operacionais de agentes (ARDEN-BE-007.7)

`AgentResultsPage.tsx` — lista + detalhe (drawer) dos registros operacionais de agente.
**Somente leitura.** A API v1 é a fonte de verdade: status, avaliação, usage, custo e
governança chegam prontos e **nunca** são recalculados no cliente.

## Lista

`useAgentResults(filtros)` → `GET …/agent-execution-results` (cursor). Filtro por status
(`SUCCEEDED/FAILED/SUSPENDED/REQUIRES_APPROVAL/UNKNOWN`). Colunas: status, avaliação,
governança, tokens totais, custo, duração. Estados loading/vazio/erro/sem-permissão.

## Detalhe (drawer)

`useAgentResult(id)` → `GET …/agent-execution-results/{id}`. Blocos:

- **Resumo**: status, avaliação, governança, duração.
- **Usage**: input/output/cached tokens, model calls, tool calls, turnos, reparos,
  aprovações (contadores).
- **Custo**: valor estimado formatado; zero conhecido anota "zero conhecido"; `null` mostra
  **"Custo não disponível"** (nunca "0,00"). Exibe `rateCardId` quando presente.
- **Avaliação**: lista dos checks determinísticos (`key`, `status`, severidade).
- **Segurança**: contador de sinais de segurança.
- **Evidência/auditoria**: quantidade de referências de evidência.

## A saída nunca é exibida

O drawer mostra apenas status, contadores, hashes e custo — **jamais** a saída completa do
modelo, prompt, instruções ou segredo (nota explícita `noOutput`). Detalhe de custo/usage
agregado em `AGENT_USAGE_AND_COST_UI.md`; governança em `AGENT_GOVERNANCE_UI.md`.
