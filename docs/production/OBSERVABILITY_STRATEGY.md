<!-- Milestone: ARDEN-PRD-001 -->
# ARDEN-PRD-001 — Estratégia de observabilidade

## Estado atual
- **Logs:** estruturados (Pino) — `apps/api/src/common/logging/logger.module.ts`;
  correlation-id por request.
- **Metrics:** **in-memory** — `apps/api/src/agents/governance/agent-metrics.ts`. Não
  exportadas externamente. Perdidas em restart.
- **Traces / error tracking / dashboards / uptime / synthetic:** **NOT FOUND**.
- **Health:** `/health` (liveness), `/ready` (readiness com `prisma.ping()`).

Classificação: **MISSING (observabilidade externa) / P0**. Métricas in-memory + logs
locais **não bastam** em produção.

## Alvo
| Sinal | Proposta |
| --- | --- |
| Logs | agregador central (retenção + busca); sem segredo (redação já aplicada) |
| Metrics | **OpenTelemetry** → Prometheus/Grafana **ou** provedor gerenciado |
| Traces | OTel tracing por request/execução |
| Dashboards | API, worker/fila, agentes, connectors |
| Error tracking | Sentry (ou equivalente) |
| Uptime checks | externo em `/health` e `/ready` |
| Synthetic checks | fluxo de login + listagem |
| Audit monitoring | alertas de sinais cross-tenant/segurança |

Opções (sem escolher prematuramente): OpenTelemetry, Prometheus/Grafana, CloudWatch,
Google Cloud Monitoring, Datadog, Sentry, Grafana Cloud. Recomendação: **OTel** como
camada de instrumentação neutra (evita lock-in), exportando para o provedor escolhido.

## Health checks (padronização proposta)
- `/livez` (= `/health`): processo responde; **sem** dependências pesadas.
- `/readyz` (= `/ready`): banco (`prisma.ping()`), migrations compatíveis, config/vault
  disponível; **sem** chamadas externas caras. Retornar 503 quando não pronto.
Manter os atuais `/health`/`/ready` como aliases para compatibilidade.
