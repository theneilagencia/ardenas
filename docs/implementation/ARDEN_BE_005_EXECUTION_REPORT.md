# ARDEN-BE-005 — Relatório de Execução

Entregue o primeiro motor real de execução assíncrona.

- **Fila**: tabela própria PostgreSQL (`execution_jobs`) com `FOR UPDATE SKIP LOCKED` +
  lease; sem Redis, sem fila em memória, sem `setTimeout` como mecanismo.
- **Worker**: processo lógico separado (`apps/api/src/worker.ts`); o controller apenas
  cria/comanda.
- **Modelo**: `execution_runs`, `execution_steps`, `execution_attempts`,
  `execution_events`, `evidence_records`, `execution_jobs` (migração
  `20260801093000_execution_engine`).
- **Criação transacional**: valida operação ativa + versão publicada (rejeita rascunho),
  reavalia autoridade (BE-004), consome autorização de uso único, materializa etapas
  (snapshot), grava eventos/evidência inicial e enfileira o job — tudo em uma transação.
- **Processamento**: máquina de estados; executores determinísticos internos; retries com
  backoff; timeout; pausa/retomada/cancelamento cooperativos; compensação em ordem inversa;
  eventos e evidências append-only.
- **Idempotência/concorrência**: `Idempotency-Key`; consumo único guardado (compare-and-set);
  jobs por `SKIP LOCKED` + lease; sequência de eventos monotônica.
- **Multitenancy**: toda query escopada; cross-tenant → 404.

Fora de escopo: conectores externos, agentes, IA (marcos BE-006/BE-007).
Ver `ARDEN_BE_005_TEST_EVIDENCE.md`.
