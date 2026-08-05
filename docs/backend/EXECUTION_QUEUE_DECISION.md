# Decisão da Fila de Execução (ARDEN-BE-005)

Decisão **obrigatória antes da implementação** (§7). Escolhe o mecanismo de fila
durável que desacopla a criação da execução (processo API) do processamento das
etapas (processo worker).

## Alternativas comparadas

| Alternativa | Durabilidade | Concorrência | Retry | Operação | Complexidade |
| --- | --- | --- | --- | --- | --- |
| **Tabela própria PostgreSQL (`FOR UPDATE SKIP LOCKED`)** | Alta — jobs persistidos com o resto do domínio, na mesma transação | Segura — `SKIP LOCKED` + lease evita dupla aquisição | Explícito e auditável (attempts, backoff, `availableAt`) | Zero infra nova; opera com o Postgres já existente; inspeção via SQL | Média — precisa implementar aquisição/lease/recuperação |
| pg-boss | Alta (Postgres) | Boa | Embutido | Baixa infra, mas adiciona schema/versão próprios e dependência | Baixa a média |
| BullMQ/Redis | Alta (se Redis persistente) | Boa | Embutido | **Exige Redis** — nova infra a operar/monitorar | Média |
| Fila em memória | **Nenhuma** (perde tudo ao reiniciar) | Frágil | Não durável | Trivial | Baixa |

## Escolha: tabela própria PostgreSQL com `FOR UPDATE SKIP LOCKED`

Motivos, na ordem dos critérios do §7:

1. **Menor infraestrutura** — o projeto já roda Postgres 16 + Prisma; nada de Redis
   nesta etapa (§6 desaconselha introduzir Redis só para isto).
2. **Durabilidade** — o job vive na mesma base transacional do domínio; criar a
   execução, consumir a autorização e enfileirar o job ocorrem em **uma** transação
   (§11/§12), impossível de garantir com fila externa.
3. **Recuperação** — jobs órfãos (worker morto) são recuperados por **lease
   expirado** (`leaseExpiresAt < now`), reprocessáveis por qualquer worker (§18).
4. **Idempotência** — `deduplicationKey` único evita jobs duplicados; a conclusão de
   etapa com efeito grava marcador, então retry não duplica efeito (§19).
5. **Observabilidade** — estado da fila é uma tabela SQL: aguardando, em lease,
   falhos, recuperados — consultável sem ferramenta externa (§45).
6. **Operar sem equipe técnica** — nada além do banco que já existe.

**Fila em memória é rejeitada para produção** (§7), assim como `setTimeout`/array
global como mecanismo de execução (§6).

## Forma da aquisição (resumo)

```sql
-- Aquisição atômica de um job disponível, sem colisão entre workers:
UPDATE execution_jobs
   SET status = 'RUNNING', locked_by = $worker, locked_at = now(),
       lease_expires_at = now() + $leaseInterval, attempts = attempts + 1
 WHERE id = (
   SELECT id FROM execution_jobs
    WHERE status IN ('QUEUED','RETRY_WAIT')
      AND available_at <= now()
    ORDER BY available_at
    FOR UPDATE SKIP LOCKED
    LIMIT 1
 )
 RETURNING *;
```

- **Lease**: um worker segura o job por uma janela; renova (`heartbeat`) enquanto
  processa; se morrer, o lease expira e o job volta a ser elegível.
- **Recuperação**: um varredor marca jobs com `lease_expires_at < now()` de volta a
  `QUEUED`, registra `execution_job.lease_expired` / `.recovered` e a tentativa
  anterior como `ABANDONED`.
- **Retry/backoff**: falha retryable agenda `available_at = now()+delay`
  (`FIXED`/`EXPONENTIAL`), respeitando `maxAttempts`; falha não-retryable encerra.

Detalhes de processamento em `EXECUTION_WORKER_MODEL.md`,
`EXECUTION_JOB_RECOVERY.md`, `EXECUTION_RETRY_POLICY.md`.
