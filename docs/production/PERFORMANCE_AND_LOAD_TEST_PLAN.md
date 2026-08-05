<!-- Milestone: ARDEN-PRD-001 -->
# ARDEN-PRD-001 — Plano de performance e carga

Estado atual: **NOT FOUND** (sem benchmark/carga). Classificação: **MISSING / P1**. Nenhuma
carga é executada nesta auditoria.

## Benchmarks propostos (baseline → p50/p95/p99, throughput, saturação)
- API: autenticação, listagens (operations/executions/audit/usage), detalhe.
- Execução: sem tools; com tool; approval pause/resume.
- Fila: burst de jobs; profundidade sob carga.
- Aprovações: criação e resolução.
- Auditoria: escrita e consulta.
- Usage rollups: agregações.
- Connector calls: latência (contra fake em teste).
- Multi-tenant: carga concorrente entre organizações.

## Métricas a coletar
baseline, p50/p95/p99, throughput, concorrência, saturação (CPU/memória), crescimento de
banco, connection pool, oldest job age.

## Cenários de carga (propostos, não destrutivos)
login+listagens · múltiplas organizações · execução sem tool · execução com tool · approval
pause/resume · queue burst · webhook burst · usage queries · audit queries · worker restart.

**Carga destrutiva NÃO é executada nesta etapa.** Resultados alimentam os SLOs
(`SLI_SLO_FRAMEWORK.md`) e o dimensionamento de réplicas/pool.
