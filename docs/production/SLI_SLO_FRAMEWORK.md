<!-- Milestone: ARDEN-PRD-001 -->
# ARDEN-PRD-001 — Framework SLI/SLO

Estado atual: **NOT FOUND**. Classificação: **MISSING / P1**. Propostas iniciais para
**piloto** — números a validar com baseline (`PERFORMANCE_AND_LOAD_TEST_PLAN.md`).
**Nenhum SLA contratual** é criado nesta auditoria.

| Serviço | SLI | SLO inicial (piloto) | Fonte |
| --- | --- | --- | --- |
| API availability | % requests não-5xx | 99.5% | uptime/metrics |
| API latency | p95 de latência | < 500 ms (leitura) | metrics |
| Execution completion | % execuções concluídas sem erro de sistema | 99% | agent metrics |
| Approval delivery | tempo até aprovação disponível | < 30 s | approvals |
| Queue processing | oldest job age | < 60 s | queue metrics |
| Audit persistence | % eventos persistidos | 100% | audit |
| Recovery | RTO em incidente SEV-1 | < 4 h | DR drill |
| Support response | tempo de 1ª resposta | conforme janela de suporte | suporte |

## Distinções
- **SLI** = medida (ex.: p95 de latência).
- **SLO** = alvo interno (ex.: p95 < 500 ms).
- **SLA** = compromisso contratual — **fora do escopo** desta auditoria.

## Regras
- SLOs de piloto são conservadores e revisáveis após baseline.
- Cada SLO tem um alerta associado (ver `ALERT_CATALOG.md`) quando aplicável.
