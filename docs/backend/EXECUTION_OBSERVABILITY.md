# Observabilidade (ARDEN-BE-005 §45)

Toda transição e tentativa geram eventos append-only (`execution.*`,
`execution_step.*`, `execution_job.*`) com `correlationId`, `causationId`,
`organizationId`, `executionRunId`, `executionStepId`, `actorType`, timestamps.

A sequência de eventos por execução é **monotônica** (unicidade no banco), permitindo
reconstruir a linha do tempo. Métricas mínimas (execuções por estado, duração, retries,
timeouts, jobs aguardando, leases expirados/recuperados) são deriváveis por SQL sobre
`execution_runs`, `execution_steps`, `execution_attempts` e `execution_jobs`. Nenhuma
plataforma externa é obrigatória nesta issue.
