# ARDEN-BE-005 — Plano de Execução

1. Confirmar BE-004 PASS, CI verde, working tree limpo; branch
   `claude/arden-be-005-execution-engine` a partir do commit final de BE-004.
2. Decisão da fila (`EXECUTION_QUEUE_DECISION.md`): tabela própria PostgreSQL +
   `FOR UPDATE SKIP LOCKED` + lease.
3. Modelo de dados + migração: `ExecutionRun/Step/Attempt/Event`, `EvidenceRecord`,
   `ExecutionJob`; índices, unicidades, tenant, FKs sem cascade destrutivo.
4. Contratos + OpenAPI + catálogo de erros + permissões (`execution.*`, `evidence.view`).
5. Máquina de estados + executores determinísticos + hash/serializers/recorder.
6. Serviço de execução (criação transacional + consumo de autorização + materialização) +
   comandos (pause/resume/cancel/retry) + endpoints.
7. Fila durável + worker separado (lease, retries, backoff, timeout, recuperação).
8. Testes unitários + integração (fila e worker reais), incluindo os críticos §40–§43.
9. Cliente v1 tipado (frontend, sem fallback) + mapas de adaptação.
10. Documentação (§48), gates verdes e PR encadeada (base BE-004, sem merge).
