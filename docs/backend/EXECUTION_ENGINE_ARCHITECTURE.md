# Arquitetura do Motor de Execução (ARDEN-BE-005)

Primeiro motor REAL de execução assíncrona do Arden.AS. Monólito modular com dois
processos LÓGICOS separados: o **API** cria/comanda execuções; o **worker** processa
as etapas. O controller nunca processa etapas dentro da requisição HTTP.

## Componentes (`apps/api/src/executions/`)

- **ExecutionsService** — criação transacional, comandos (pause/resume/cancel/retry),
  leitura. Consome a `ActionAuthorization` de uso único e materializa as etapas.
- **ExecutionStateMachine** (`execution.state-machine.ts`) — transições permitidas.
- **Executores** (`executors.ts`) — catálogo determinístico interno; sem `eval`.
- **ExecutionQueue** (`execution.queue.ts`) — fila durável PostgreSQL (SKIP LOCKED).
- **ExecutionProcessor** (`execution.processor.ts`) — processa um job/execução.
- **ExecutionWorker** (`execution.worker.ts`) — loop de aquisição/recuperação.
- **ExecutionRecorder** — eventos e evidências append-only.
- **worker.ts** — entrypoint do processo worker (contexto Nest, sem HTTP).

## Fluxo

criar (API, transacional) → `PENDING→QUEUED` + job na fila → worker adquire →
`QUEUED→RUNNING` → processa etapas determinísticas (checkpoints de pause/cancel/
timeout) → `SUCCEEDED | FAILED→COMPENSATING→COMPENSATED | CANCELLED | TIMED_OUT`.

A versão executada é a **publicada corrente** (nunca rascunho); a execução é
reproduzível mesmo após nova publicação, pois as etapas são um snapshot.

Ver: `EXECUTION_STATE_MACHINE.md`, `EXECUTION_QUEUE_DECISION.md`,
`EXECUTION_WORKER_MODEL.md`, `EXECUTION_COMPENSATION.md`.
