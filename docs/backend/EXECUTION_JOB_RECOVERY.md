# Recuperação de Jobs (ARDEN-BE-005 §18)

Fila durável (`execution_jobs`) com lease. Se um worker morre durante uma etapa:

1. O `lease_expires_at` do job expira.
2. O varredor `recoverExpiredLeases()` (rodado a cada iteração do worker) devolve o job a
   `QUEUED` (`available_at = now`), registrando `execution_job.lease_expired` e
   `execution_job.recovered`.
3. Outro worker adquire o job e **retoma** do ponto correto: etapas já `SUCCEEDED` não
   são reprocessadas; a próxima etapa pendente é processada.

Efeitos confirmados não são duplicados (executores determinísticos + etapas concluídas
não reexecutam). Teste crítico em `execution-critical.integration.spec.ts` (§41).
