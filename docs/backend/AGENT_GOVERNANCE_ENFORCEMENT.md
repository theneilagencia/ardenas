# Agent governance enforcement (ARDEN-BE-007.6)

`AgentGovernanceEvaluator.evaluate(...)` classifica o resultado sob a política de custo/
consumo do agente e sinais de segurança. É PURO e roda no recorder após usage/custo.

## Status

| Status | Quando | `action` |
| --- | --- | --- |
| `WITHIN_LIMITS` | dentro de todos os limites, sem sinal crítico | — |
| `LIMIT_WARNING` | consumo ≥ 80% de um teto (tokens/tool calls/custo) | observar |
| `LIMIT_EXCEEDED` | `errorCode` de limite, ou custo estimado > teto | `actionOnLimit` |
| `BLOCKED` | sinal de segurança CRÍTICO / injeção detectada | falha segura |

`reasonCode` acompanha o status (ex.: `TOKEN_LIMIT`, `COST_LIMIT`, `TOOL_LIMIT`,
`CRITICAL_SECURITY_SIGNAL`). `actionOnLimit` (`FAIL`/`SUSPEND`/`REQUIRE_APPROVAL`) vem da
`AgentCostPolicy` da versão do agente.

## Limite de custo

Comparado só quando há custo estimado E teto na mesma `currency` (inteiros). Custo `null`
(rate card ausente) nunca dispara `LIMIT_EXCEEDED` por custo — a ausência é sinalizada por
warning de custo, não por estouro de teto inventado.

## Efeitos operacionais

O recorder emite `agent.limit_exceeded` (para `LIMIT_EXCEEDED`/`BLOCKED`) ou
`agent.limit_warning` (para `LIMIT_WARNING`) e a métrica `arden_agent_limit_exceeded_total`.
O enforcement em TEMPO REAL dos tetos de turno/token/custo durante o loop continua no
runtime (BE-007.3/.5, `AGENT_COST_AND_USAGE.md`); esta camada é a classificação FINAL
persistida e consultável. Ver `AGENT_OPERATIONAL_ALERTS.md`.
