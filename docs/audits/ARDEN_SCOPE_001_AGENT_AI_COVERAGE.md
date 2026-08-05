<!-- Milestone: ARDEN-SCOPE-001 -->
# ARDEN-SCOPE-001 — Cobertura de agentes e IA

Score: **93,3%** (15 requisitos). Distinção obrigatória IMPLEMENTED_OFFLINE vs
IMPLEMENTED_LIVE vs PRODUCTION_READY.

| Capacidade | Evidência | Status |
| --- | --- | --- |
| Agentes (CRUD/ciclo) | AgentDefinition; features/agents (api-real) | COMPLETE |
| Versões imutáveis | AgentVersion publish/retire; publish concorrente (um vence) | COMPLETE |
| Runtime loop de tools | agent-runtime.ts; autoridade ALLOW/REQUIRE_APPROVAL/DENY | COMPLETE |
| Suspensão/retomada + checkpoint | WRITE→aprovação→suspende→retoma uma vez | COMPLETE |
| Isolamento de contexto | injeção detectada; tool-result não-confiável isolado; orçamento | COMPLETE |
| Model configurations + catálogo | CRUD/lifecycle; provedores/modelos projetados | COMPLETE |
| Provider determinístico interno | internal.test-model (sem SDK/rede/segredo) | COMPLETE |
| Anthropic — structured output offline | fake transport em teste | COMPLETE (offline) |
| Anthropic — tool calling offline | tool_use offline; negação de tool desconhecida | COMPLETE (offline) |
| Uso/custo/avaliação/rollups | usage>0; custo por rate-card ou null; avaliação determinística | COMPLETE |
| **Anthropic — execução real/produção** | SDK live-capable em não-prod sob gates; **produção bloqueada**; live calls NONE; pricing/data-gov UNVERIFIED | **BLOCKED_BY_EXTERNAL_PROVIDER** |

## Classificação Anthropic
- **IMPLEMENTED_OFFLINE:** SIM (structured output + tool calling comprovados offline).
- **IMPLEMENTED_LIVE:** caminho SDK existe e é alcançável **em não-produção** sob múltiplos
  gates server-side; **nenhum teste exercita chamada real**.
- **PRODUCTION_READY:** **NÃO** — produção bloqueada por design; pricing/data governance
  não verificados.
